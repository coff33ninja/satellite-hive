package main

import (
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"runtime"
	"sync"

	"github.com/creack/pty"
)

type PtySession struct {
	ID     string
	ptmx   *os.File
	cmd    *exec.Cmd
	agent  *Agent
	mu     sync.Mutex
	closed bool
}

var (
	ptySessions   = make(map[string]*PtySession)
	ptySessionsMu sync.RWMutex
)

func (a *Agent) handlePtyStart(message map[string]interface{}) {
	sessionID, _ := message["session_id"].(string)
	requestID, _ := message["request_id"].(string)
	shell, _ := message["shell"].(string)
	cols, _ := message["cols"].(float64)
	rows, _ := message["rows"].(float64)

	if shell == "" {
		if runtime.GOOS == "windows" {
			shell = "powershell.exe"
		} else {
			shell = os.Getenv("SHELL")
			if shell == "" {
				shell = "/bin/bash"
			}
		}
	}

	fmt.Printf("[PTY] Starting session %s with shell: %s (size: %.0fx%.0f)\n", sessionID, shell, cols, rows)

	// Create command
	cmd := exec.Command(shell)
	cmd.Env = os.Environ()

	// Start PTY
	ptmx, err := pty.Start(cmd)
	if err != nil {
		log.Printf("Failed to start PTY: %v", err)
		a.sendPtyError(sessionID, requestID, err)
		return
	}

	// Set size
	if cols > 0 && rows > 0 {
		pty.Setsize(ptmx, &pty.Winsize{
			Rows: uint16(rows),
			Cols: uint16(cols),
		})
	}

	session := &PtySession{
		ID:    sessionID,
		ptmx:  ptmx,
		cmd:   cmd,
		agent: a,
	}

	ptySessionsMu.Lock()
	ptySessions[sessionID] = session
	ptySessionsMu.Unlock()

	// Send started confirmation
	a.conn.WriteJSON(map[string]interface{}{
		"type":       "pty_started",
		"request_id": requestID,
		"session_id": sessionID,
		"success":    true,
		"pid":        cmd.Process.Pid,
	})

	// Start reading output
	go session.readOutput()

	// Wait for process to exit
	go func() {
		err := cmd.Wait()
		exitCode := 0
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
			}
		}

		session.close()

		a.conn.WriteJSON(map[string]interface{}{
			"type":       "pty_ended",
			"session_id": sessionID,
			"exit_code":  exitCode,
			"reason":     "exited",
		})

		ptySessionsMu.Lock()
		delete(ptySessions, sessionID)
		ptySessionsMu.Unlock()

		log.Printf("PTY session %s ended with exit code %d", sessionID, exitCode)
	}()
}

func (s *PtySession) readOutput() {
	buf := make([]byte, 4096)
	for {
		n, err := s.ptmx.Read(buf)
		if err != nil {
			if err != io.EOF {
				log.Printf("PTY read error: %v", err)
			}
			return
		}

		if n > 0 {
			// Send output to server
			encoded := base64.StdEncoding.EncodeToString(buf[:n])
			s.agent.conn.WriteJSON(map[string]interface{}{
				"type":       "pty_output",
				"session_id": s.ID,
				"data":       encoded,
			})
		}
	}
}

func (s *PtySession) close() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return
	}

	s.closed = true
	if s.ptmx != nil {
		s.ptmx.Close()
	}
}

func (a *Agent) handlePtyInput(message map[string]interface{}) {
	sessionID, _ := message["session_id"].(string)
	dataEncoded, _ := message["data"].(string)

	ptySessionsMu.RLock()
	session, exists := ptySessions[sessionID]
	ptySessionsMu.RUnlock()

	if !exists {
		log.Printf("PTY session %s not found", sessionID)
		return
	}

	data, err := base64.StdEncoding.DecodeString(dataEncoded)
	if err != nil {
		log.Printf("Failed to decode PTY input: %v", err)
		return
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	if !session.closed {
		session.ptmx.Write(data)
	}
}

func (a *Agent) handlePtyResize(message map[string]interface{}) {
	sessionID, _ := message["session_id"].(string)
	cols, _ := message["cols"].(float64)
	rows, _ := message["rows"].(float64)

	ptySessionsMu.RLock()
	session, exists := ptySessions[sessionID]
	ptySessionsMu.RUnlock()

	if !exists {
		return
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	if !session.closed {
		pty.Setsize(session.ptmx, &pty.Winsize{
			Rows: uint16(rows),
			Cols: uint16(cols),
		})
	}
}

func (a *Agent) handlePtyEnd(message map[string]interface{}) {
	sessionID, _ := message["session_id"].(string)

	ptySessionsMu.RLock()
	session, exists := ptySessions[sessionID]
	ptySessionsMu.RUnlock()

	if !exists {
		return
	}

	session.close()
	if session.cmd.Process != nil {
		session.cmd.Process.Kill()
	}
}

func (a *Agent) sendPtyError(sessionID, requestID string, err error) {
	a.conn.WriteJSON(map[string]interface{}{
		"type":       "error",
		"request_id": requestID,
		"session_id": sessionID,
		"error": map[string]interface{}{
			"code":    "PTY_START_FAILED",
			"message": err.Error(),
		},
	})
}
