package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

const Version = "1.0.0"

type Config struct {
	ServerURL string   `yaml:"server_url"`
	AgentID   string   `yaml:"agent_id"`
	Token     string   `yaml:"token"`
	Name      string   `yaml:"name"`
	Tags      []string `yaml:"tags"`
}

type SystemInfo struct {
	Hostname           string                   `json:"hostname"`
	OS                 string                   `json:"os"`
	OSVersion          string                   `json:"os_version"`
	Arch               string                   `json:"arch"`
	Kernel             string                   `json:"kernel"`
	UptimeSeconds      uint64                   `json:"uptime_seconds"`
	CPUCores           int                      `json:"cpu_cores"`
	MemoryTotalMB      uint64                   `json:"memory_total_mb"`
	MemoryAvailableMB  uint64                   `json:"memory_available_mb"`
	DiskTotalGB        uint64                   `json:"disk_total_gb"`
	DiskAvailableGB    uint64                   `json:"disk_available_gb"`
	IPAddresses        []NetworkInterface       `json:"ip_addresses"`
	MacAddresses       []MacAddress             `json:"mac_addresses"`
}

type NetworkInterface struct {
	Interface string `json:"interface"`
	IPv4      string `json:"ipv4,omitempty"`
	IPv6      string `json:"ipv6,omitempty"`
}

type MacAddress struct {
	Interface string `json:"interface"`
	MAC       string `json:"mac"`
}

type Metrics struct {
	CPUPercent       float64 `json:"cpu_percent"`
	MemoryPercent    float64 `json:"memory_percent"`
	DiskPercent      float64 `json:"disk_percent"`
	NetworkRxBytes   uint64  `json:"network_rx_bytes"`
	NetworkTxBytes   uint64  `json:"network_tx_bytes"`
	ActiveSessions   int     `json:"active_sessions"`
}

type Agent struct {
	config *Config
	conn   *websocket.Conn
}

func main() {
	serverURL := flag.String("server", "ws://localhost:3000/ws/agent", "Server WebSocket URL")
	agentID := flag.String("id", "", "Agent ID")
	token := flag.String("token", "test-token", "Authentication token")
	name := flag.String("name", "", "Agent name")
	flag.Parse()

	if *name == "" {
		hostname, _ := os.Hostname()
		*name = hostname
	}

	config := &Config{
		ServerURL: *serverURL,
		AgentID:   *agentID,
		Token:     *token,
		Name:      *name,
		Tags:      []string{"test"},
	}

	agent := &Agent{config: config}

	// Handle shutdown gracefully
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Shutting down...")
		if agent.conn != nil {
			agent.conn.Close()
		}
		os.Exit(0)
	}()

	// Connect and run
	for {
		if err := agent.connect(); err != nil {
			log.Printf("Connection failed: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		if err := agent.run(); err != nil {
			log.Printf("Error: %v", err)
		}

		log.Println("Reconnecting in 5 seconds...")
		time.Sleep(5 * time.Second)
	}
}

func (a *Agent) connect() error {
	log.Printf("Connecting to %s...", a.config.ServerURL)

	conn, _, err := websocket.DefaultDialer.Dial(a.config.ServerURL, nil)
	if err != nil {
		return fmt.Errorf("dial failed: %w", err)
	}

	a.conn = conn
	log.Println("Connected!")

	// Send handshake
	systemInfo, err := collectSystemInfo()
	if err != nil {
		return fmt.Errorf("failed to collect system info: %w", err)
	}

	handshake := map[string]interface{}{
		"type":         "handshake",
		"agent_id":     a.config.AgentID,
		"token":        a.config.Token,
		"version":      Version,
		"name":         a.config.Name,
		"system":       systemInfo,
		"capabilities": []string{"shell", "pty", "metrics"},
		"tags":         a.config.Tags,
	}

	if err := a.conn.WriteJSON(handshake); err != nil {
		return fmt.Errorf("handshake failed: %w", err)
	}

	log.Println("Handshake sent, waiting for acknowledgment...")

	// Wait for handshake response
	var response map[string]interface{}
	if err := a.conn.ReadJSON(&response); err != nil {
		return fmt.Errorf("handshake response failed: %w", err)
	}

	if response["type"] == "handshake_ack" && response["success"] == true {
		log.Println("✅ Handshake successful!")
		return nil
	}

	return fmt.Errorf("handshake rejected: %v", response)
}

func (a *Agent) run() error {
	// Start heartbeat
	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()

	for {
		select {
		case <-heartbeatTicker.C:
			// Send heartbeat with metrics
			metrics, _ := collectMetrics()
			heartbeat := map[string]interface{}{
				"type":      "heartbeat_pong",
				"timestamp": time.Now().Format(time.RFC3339),
				"metrics":   metrics,
			}
			if err := a.conn.WriteJSON(heartbeat); err != nil {
				return fmt.Errorf("heartbeat failed: %w", err)
			}

		default:
			// Read messages from server
			var message map[string]interface{}
			if err := a.conn.ReadJSON(&message); err != nil {
				return fmt.Errorf("read failed: %w", err)
			}

			a.handleMessage(message)
		}
	}
}

func (a *Agent) handleMessage(message map[string]interface{}) {
	msgType, ok := message["type"].(string)
	if !ok {
		return
	}

	switch msgType {
	case "heartbeat_ping":
		// Server is checking if we're alive
		log.Println("Received heartbeat ping")

	case "exec":
		// Execute command
		go a.handleExec(message)

	case "pty_start":
		// Start PTY session
		go a.handlePtyStart(message)

	case "pty_input":
		// PTY input
		a.handlePtyInput(message)

	case "pty_resize":
		// PTY resize
		a.handlePtyResize(message)

	case "pty_end":
		// End PTY session
		a.handlePtyEnd(message)

	default:
		log.Printf("Unknown message type: %s", msgType)
	}
}

func collectSystemInfo() (*SystemInfo, error) {
	hostname, _ := os.Hostname()
	hostInfo, _ := host.Info()
	memInfo, _ := mem.VirtualMemory()
	diskInfo, _ := disk.Usage("/")
	interfaces, _ := net.Interfaces()

	info := &SystemInfo{
		Hostname:          hostname,
		OS:                runtime.GOOS,
		OSVersion:         hostInfo.Platform + " " + hostInfo.PlatformVersion,
		Arch:              runtime.GOARCH,
		Kernel:            hostInfo.KernelVersion,
		UptimeSeconds:     hostInfo.Uptime,
		CPUCores:          runtime.NumCPU(),
		MemoryTotalMB:     memInfo.Total / 1024 / 1024,
		MemoryAvailableMB: memInfo.Available / 1024 / 1024,
		DiskTotalGB:       diskInfo.Total / 1024 / 1024 / 1024,
		DiskAvailableGB:   diskInfo.Free / 1024 / 1024 / 1024,
		IPAddresses:       []NetworkInterface{},
		MacAddresses:      []MacAddress{},
	}

	// Collect network interfaces
	for _, iface := range interfaces {
		if len(iface.Addrs) > 0 {
			for _, addr := range iface.Addrs {
				info.IPAddresses = append(info.IPAddresses, NetworkInterface{
					Interface: iface.Name,
					IPv4:      addr.Addr,
				})
			}
		}
		if iface.HardwareAddr != "" {
			info.MacAddresses = append(info.MacAddresses, MacAddress{
				Interface: iface.Name,
				MAC:       iface.HardwareAddr,
			})
		}
	}

	return info, nil
}

func collectMetrics() (*Metrics, error) {
	cpuPercent, _ := cpu.Percent(time.Second, false)
	memInfo, _ := mem.VirtualMemory()
	diskInfo, _ := disk.Usage("/")
	netStats, _ := net.IOCounters(false)

	metrics := &Metrics{
		CPUPercent:     cpuPercent[0],
		MemoryPercent:  memInfo.UsedPercent,
		DiskPercent:    diskInfo.UsedPercent,
		ActiveSessions: 0,
	}

	if len(netStats) > 0 {
		metrics.NetworkRxBytes = netStats[0].BytesRecv
		metrics.NetworkTxBytes = netStats[0].BytesSent
	}

	return metrics, nil
}
