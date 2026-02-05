package main

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os/exec"
	"runtime"
	"time"
)

func (a *Agent) handleExec(message map[string]interface{}) {
	requestID, _ := message["request_id"].(string)
	command, _ := message["command"].(string)
	timeoutSec, _ := message["timeout_seconds"].(float64)

	if timeoutSec == 0 {
		timeoutSec = 30
	}

	fmt.Printf("[EXEC] Executing command: %s (timeout: %.0fs)\n", command, timeoutSec)

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSec)*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "cmd", "/C", command)
	} else {
		cmd = exec.CommandContext(ctx, "sh", "-c", command)
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	startTime := time.Now()
	err := cmd.Run()
	duration := time.Since(startTime)

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
		}
	}

	response := map[string]interface{}{
		"type":        "exec_result",
		"request_id":  requestID,
		"success":     exitCode == 0,
		"exit_code":   exitCode,
		"stdout":      stdout.String(),
		"stderr":      stderr.String(),
		"duration_ms": duration.Milliseconds(),
		"truncated":   false,
	}

	if err := a.conn.WriteJSON(response); err != nil {
		log.Printf("Failed to send exec result: %v", err)
	}

	fmt.Printf("[EXEC] Command completed with exit code %d (duration: %dms)\n", exitCode, duration.Milliseconds())
}
