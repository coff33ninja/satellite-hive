package main

import (
	"fmt"
	"os/exec"
	"runtime"
)

// PowerCommand represents a power management command
type PowerCommand string

const (
	PowerShutdown PowerCommand = "shutdown"
	PowerReboot   PowerCommand = "reboot"
	PowerSleep    PowerCommand = "sleep"
	PowerHibernate PowerCommand = "hibernate"
)

// ExecutePowerCommand executes a power management command
func ExecutePowerCommand(command PowerCommand) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = getPowerCommandWindows(command)
	case "linux":
		cmd = getPowerCommandLinux(command)
	case "darwin":
		cmd = getPowerCommandDarwin(command)
	default:
		return fmt.Errorf("unsupported operating system: %s", runtime.GOOS)
	}

	if cmd == nil {
		return fmt.Errorf("unsupported power command: %s on %s", command, runtime.GOOS)
	}

	return cmd.Run()
}

func getPowerCommandWindows(command PowerCommand) *exec.Cmd {
	switch command {
	case PowerShutdown:
		return exec.Command("shutdown", "/s", "/t", "10", "/c", "Shutdown initiated by Satellite Hive")
	case PowerReboot:
		return exec.Command("shutdown", "/r", "/t", "10", "/c", "Reboot initiated by Satellite Hive")
	case PowerSleep:
		// Windows sleep via rundll32
		return exec.Command("rundll32.exe", "powrprof.dll,SetSuspendState", "0", "1", "0")
	case PowerHibernate:
		return exec.Command("shutdown", "/h")
	default:
		return nil
	}
}

func getPowerCommandLinux(command PowerCommand) *exec.Cmd {
	switch command {
	case PowerShutdown:
		// Try systemctl first, fallback to shutdown
		if _, err := exec.LookPath("systemctl"); err == nil {
			return exec.Command("systemctl", "poweroff")
		}
		return exec.Command("shutdown", "-h", "now")
	case PowerReboot:
		if _, err := exec.LookPath("systemctl"); err == nil {
			return exec.Command("systemctl", "reboot")
		}
		return exec.Command("shutdown", "-r", "now")
	case PowerSleep:
		if _, err := exec.LookPath("systemctl"); err == nil {
			return exec.Command("systemctl", "suspend")
		}
		return nil
	case PowerHibernate:
		if _, err := exec.LookPath("systemctl"); err == nil {
			return exec.Command("systemctl", "hibernate")
		}
		return nil
	default:
		return nil
	}
}

func getPowerCommandDarwin(command PowerCommand) *exec.Cmd {
	switch command {
	case PowerShutdown:
		return exec.Command("shutdown", "-h", "now")
	case PowerReboot:
		return exec.Command("shutdown", "-r", "now")
	case PowerSleep:
		return exec.Command("pmset", "sleepnow")
	case PowerHibernate:
		// macOS doesn't have traditional hibernate, use deep sleep
		return exec.Command("pmset", "sleepnow")
	default:
		return nil
	}
}
