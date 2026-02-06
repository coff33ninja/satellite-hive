package main

import (
	"log"
	"runtime"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

// SystemMetrics represents collected system metrics
type SystemMetrics struct {
	CPUUsage        float64 `json:"cpu_usage"`
	MemoryTotal     uint64  `json:"memory_total"`
	MemoryUsed      uint64  `json:"memory_used"`
	MemoryPercent   float64 `json:"memory_percent"`
	DiskTotal       uint64  `json:"disk_total"`
	DiskUsed        uint64  `json:"disk_used"`
	DiskPercent     float64 `json:"disk_percent"`
	NetworkBytesSent uint64 `json:"network_bytes_sent"`
	NetworkBytesRecv uint64 `json:"network_bytes_recv"`
	LoadAvg1        float64 `json:"load_avg_1,omitempty"`
	LoadAvg5        float64 `json:"load_avg_5,omitempty"`
	LoadAvg15       float64 `json:"load_avg_15,omitempty"`
	ProcessCount    int     `json:"process_count"`
	UptimeSeconds   uint64  `json:"uptime_seconds"`
}

// CollectMetrics gathers system metrics
func CollectMetrics() (*SystemMetrics, error) {
	metrics := &SystemMetrics{}

	// CPU Usage
	cpuPercent, err := cpu.Percent(0, false)
	if err == nil && len(cpuPercent) > 0 {
		metrics.CPUUsage = cpuPercent[0]
	} else if err != nil {
		log.Printf("Warning: Failed to get CPU usage: %v", err)
	}

	// Memory
	vmem, err := mem.VirtualMemory()
	if err == nil {
		metrics.MemoryTotal = vmem.Total
		metrics.MemoryUsed = vmem.Used
		metrics.MemoryPercent = vmem.UsedPercent
	} else {
		log.Printf("Warning: Failed to get memory info: %v", err)
	}

	// Disk (root partition)
	diskPath := "/"
	if runtime.GOOS == "windows" {
		diskPath = "C:"
	}
	diskUsage, err := disk.Usage(diskPath)
	if err == nil {
		metrics.DiskTotal = diskUsage.Total
		metrics.DiskUsed = diskUsage.Used
		metrics.DiskPercent = diskUsage.UsedPercent
	} else {
		log.Printf("Warning: Failed to get disk info: %v", err)
	}

	// Network
	netIO, err := net.IOCounters(false)
	if err == nil && len(netIO) > 0 {
		metrics.NetworkBytesSent = netIO[0].BytesSent
		metrics.NetworkBytesRecv = netIO[0].BytesRecv
	} else if err != nil {
		log.Printf("Warning: Failed to get network info: %v", err)
	}

	// Load Average (Unix-like systems only)
	if runtime.GOOS != "windows" {
		loadAvg, err := load.Avg()
		if err == nil {
			metrics.LoadAvg1 = loadAvg.Load1
			metrics.LoadAvg5 = loadAvg.Load5
			metrics.LoadAvg15 = loadAvg.Load15
		} else {
			log.Printf("Warning: Failed to get load average: %v", err)
		}
	}

	// Process Count
	processes, err := process.Processes()
	if err == nil {
		metrics.ProcessCount = len(processes)
	} else {
		log.Printf("Warning: Failed to get process count: %v", err)
	}

	// Uptime
	uptime, err := host.Uptime()
	if err == nil {
		metrics.UptimeSeconds = uptime
	} else {
		log.Printf("Warning: Failed to get uptime: %v", err)
	}

	return metrics, nil
}
