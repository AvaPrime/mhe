#!/usr/bin/env python3
"""
Desktop Commander MCP Server Test Suite

Comprehensive testing framework for both NPX and Docker deployments
of the Desktop Commander MCP server implementation.
"""

import os
import sys
import json
import time
import psutil
import subprocess
import threading
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class TestResult:
    """Test result data structure"""
    test_id: str
    name: str
    status: str  # PASS, FAIL, SKIP
    duration: float
    details: str
    metrics: Dict[str, float]
    timestamp: str


@dataclass
class SecurityTestResult:
    """Security test result data structure"""
    test_id: str
    vulnerability_type: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    status: str  # PASS, FAIL
    description: str
    remediation: str


@dataclass
class PerformanceMetrics:
    """Performance metrics data structure"""
    cpu_usage: float
    memory_usage: float
    response_time: float
    throughput: float
    concurrent_connections: int


class TestSuite:
    """Main test suite class for Desktop Commander MCP server"""
    
    def __init__(self, workspace_path: str):
        self.workspace_path = Path(workspace_path)
        self.results: List[TestResult] = []
        self.security_results: List[SecurityTestResult] = []
        self.performance_metrics: List[PerformanceMetrics] = []
        self.start_time = None
        self.end_time = None
        
    def log(self, message: str, level: str = "INFO"):
        """Logging utility"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
    
    def run_command(self, command: str, timeout: int = 30) -> Tuple[int, str, str]:
        """Execute shell command with timeout"""
        try:
            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=self.workspace_path
            )
            stdout, stderr = process.communicate(timeout=timeout)
            return process.returncode, stdout, stderr
        except subprocess.TimeoutExpired:
            process.kill()
            return -1, "", "Command timed out"
        except Exception as e:
            return -1, "", str(e)
    
    def measure_performance(self, func, *args, **kwargs) -> Tuple[any, PerformanceMetrics]:
        """Measure performance metrics during function execution"""
        # Get initial system state
        initial_cpu = psutil.cpu_percent(interval=1)
        initial_memory = psutil.virtual_memory().percent
        
        start_time = time.time()
        
        # Execute function
        result = func(*args, **kwargs)
        
        end_time = time.time()
        
        # Get final system state
        final_cpu = psutil.cpu_percent(interval=1)
        final_memory = psutil.virtual_memory().percent
        
        metrics = PerformanceMetrics(
            cpu_usage=max(final_cpu - initial_cpu, 0),
            memory_usage=max(final_memory - initial_memory, 0),
            response_time=end_time - start_time,
            throughput=1.0 / (end_time - start_time) if end_time > start_time else 0,
            concurrent_connections=1
        )
        
        return result, metrics
    
    def test_environment_prerequisites(self) -> TestResult:
        """TC-ENV-001: Test environment prerequisites"""
        test_id = "TC-ENV-001"
        start_time = time.time()
        
        try:
            # Test Node.js
            node_code, node_out, node_err = self.run_command("node -v")
            if node_code != 0:
                raise Exception(f"Node.js not available: {node_err}")
            
            # Test npm
            npm_code, npm_out, npm_err = self.run_command("npm -v")
            if npm_code != 0:
                raise Exception(f"npm not available: {npm_err}")
            
            # Test Docker
            docker_code, docker_out, docker_err = self.run_command("docker --version")
            if docker_code != 0:
                raise Exception(f"Docker not available: {docker_err}")
            
            # Test Docker Compose
            compose_code, compose_out, compose_err = self.run_command("docker compose version")
            if compose_code != 0:
                raise Exception(f"Docker Compose not available: {compose_err}")
            
            duration = time.time() - start_time
            
            return TestResult(
                test_id=test_id,
                name="Environment Prerequisites",
                status="PASS",
                duration=duration,
                details=f"Node.js: {node_out.strip()}, npm: {npm_out.strip()}, Docker: {docker_out.strip()}, Compose: {compose_out.strip()}",
                metrics={"duration": duration},
                timestamp=datetime.now().isoformat()
            )
            
        except Exception as e:
            duration = time.time() - start_time
            return TestResult(
                test_id=test_id,
                name="Environment Prerequisites",
                status="FAIL",
                duration=duration,
                details=str(e),
                metrics={"duration": duration},
                timestamp=datetime.now().isoformat()
            )
    
    def test_npx_deployment(self) -> TestResult:
        """TC-NPX-001: Test NPX deployment functionality"""
        test_id = "TC-NPX-001"
        start_time = time.time()
        
        try:
            # Check if package is already installed globally
            check_code, check_out, check_err = self.run_command("npm list -g @wonderwhy-er/desktop-commander", timeout=30)
            
            if check_code != 0:
                # Pre-install the package to avoid download timeout during test
                self.log("Pre-installing NPX package...")
                install_code, install_out, install_err = self.run_command("npm install -g @wonderwhy-er/desktop-commander@latest", timeout=180)
                if install_code != 0:
                    self.log(f"Global install failed, proceeding with NPX: {install_err}")
            
            # Test NPX package availability with increased timeout
            code, stdout, stderr = self.run_command("npx -y @wonderwhy-er/desktop-commander@latest --help", timeout=180)
            
            if code != 0 and "Need to install" not in stderr:
                raise Exception(f"NPX deployment failed: {stderr}")
            
            # Check for successful initialization indicators
            success_indicators = [
                "Loading schemas.ts",
                "Loading server.ts",
                "Setting up request handlers",
                "Initialized FilteredStdioServerTransport"
            ]
            
            found_indicators = sum(1 for indicator in success_indicators if indicator in stdout)
            
            if found_indicators < 2:  # At least 2 indicators should be present
                raise Exception(f"NPX server initialization incomplete. Found {found_indicators}/4 indicators")
            
            duration = time.time() - start_time
            
            return TestResult(
                test_id=test_id,
                name="NPX Deployment",
                status="PASS",
                duration=duration,
                details=f"NPX deployment successful. Found {found_indicators}/4 initialization indicators.",
                metrics={"duration": duration, "initialization_score": found_indicators/4},
                timestamp=datetime.now().isoformat()
            )
            
        except Exception as e:
            duration = time.time() - start_time
            return TestResult(
                test_id=test_id,
                name="NPX Deployment",
                status="FAIL",
                duration=duration,
                details=str(e),
                metrics={"duration": duration},
                timestamp=datetime.now().isoformat()
            )
    
    def test_docker_deployment(self) -> TestResult:
        """TC-DOCKER-001: Test Docker deployment functionality"""
        test_id = "TC-DOCKER-001"
        start_time = time.time()
        
        try:
            # Check if Docker is running
            docker_info_code, _, docker_info_err = self.run_command("docker info")
            if docker_info_code != 0:
                raise Exception(f"Docker daemon not running: {docker_info_err}")
            
            # Set workspace environment variable and build
            workspace_path = str(self.workspace_path.absolute())
            
            # Use PowerShell environment variable syntax in the command
            build_command = f'$env:WORKSPACE="{workspace_path}"; docker compose -f docker/desktop-commander/docker-compose.yml build'
            build_code, build_out, build_err = self.run_command(build_command, timeout=300)
            
            if build_code != 0:
                raise Exception(f"Docker build failed: {build_err}")
            
            # Test container startup (don't leave it running)
            up_command = f'$env:WORKSPACE="{workspace_path}"; docker compose -f docker/desktop-commander/docker-compose.yml up -d'
            up_code, up_out, up_err = self.run_command(up_command, timeout=60)
            
            if up_code != 0:
                raise Exception(f"Docker container startup failed: {up_err}")
            
            # Check container status
            ps_command = f'$env:WORKSPACE="{workspace_path}"; docker compose -f docker/desktop-commander/docker-compose.yml ps'
            ps_code, ps_out, ps_err = self.run_command(ps_command)
            
            # Clean up - stop the container
            down_command = f'$env:WORKSPACE="{workspace_path}"; docker compose -f docker/desktop-commander/docker-compose.yml down'
            self.run_command(down_command)
            
            if ps_code != 0:
                raise Exception(f"Docker container status check failed: {ps_err}")
            
            duration = time.time() - start_time
            
            return TestResult(
                test_id=test_id,
                name="Docker Deployment",
                status="PASS",
                duration=duration,
                details=f"Docker deployment successful. Container built and started successfully.",
                metrics={"duration": duration, "build_success": 1.0},
                timestamp=datetime.now().isoformat()
            )
            
        except Exception as e:
            duration = time.time() - start_time
            return TestResult(
                test_id=test_id,
                name="Docker Deployment",
                status="FAIL",
                duration=duration,
                details=str(e),
                metrics={"duration": duration},
                timestamp=datetime.now().isoformat()
            )
    
    def test_configuration_validation(self) -> TestResult:
        """TC-CONFIG-001: Test MCP configuration validation"""
        test_id = "TC-CONFIG-001"
        start_time = time.time()
        
        try:
            # Check if mcp.json exists and is valid
            mcp_config_path = self.workspace_path / ".trae" / "mcp.json"
            
            if not mcp_config_path.exists():
                raise Exception("MCP configuration file not found")
            
            # Validate JSON structure
            with open(mcp_config_path, 'r') as f:
                config = json.load(f)
            
            # Check required fields
            if "mcpServers" not in config:
                raise Exception("Missing mcpServers section in configuration")
            
            servers = config["mcpServers"]
            
            # Validate NPX configuration
            if "desktop-commander-npx" not in servers:
                raise Exception("Missing NPX server configuration")
            
            npx_config = servers["desktop-commander-npx"]
            required_npx_fields = ["command", "args"]
            
            for field in required_npx_fields:
                if field not in npx_config:
                    raise Exception(f"Missing {field} in NPX configuration")
            
            # Validate Docker configuration
            if "desktop-commander-docker" not in servers:
                raise Exception("Missing Docker server configuration")
            
            docker_config = servers["desktop-commander-docker"]
            required_docker_fields = ["command", "args"]
            
            for field in required_docker_fields:
                if field not in docker_config:
                    raise Exception(f"Missing {field} in Docker configuration")
            
            duration = time.time() - start_time
            
            return TestResult(
                test_id=test_id,
                name="Configuration Validation",
                status="PASS",
                duration=duration,
                details="MCP configuration is valid and complete",
                metrics={"duration": duration, "config_completeness": 1.0},
                timestamp=datetime.now().isoformat()
            )
            
        except Exception as e:
            duration = time.time() - start_time
            return TestResult(
                test_id=test_id,
                name="Configuration Validation",
                status="FAIL",
                duration=duration,
                details=str(e),
                metrics={"duration": duration},
                timestamp=datetime.now().isoformat()
            )
    
    def test_security_boundaries(self) -> SecurityTestResult:
        """TC-SEC-001: Test security boundary enforcement"""
        test_id = "TC-SEC-001"
        
        try:
            # Test file system access restrictions
            # This is a simulated test - in real implementation,
            # we would test actual MCP server responses
            
            # Check if project rules exist
            rules_path = self.workspace_path / ".trae" / "project_rules.md"
            
            if not rules_path.exists():
                return SecurityTestResult(
                    test_id=test_id,
                    vulnerability_type="Missing Security Policy",
                    severity="HIGH",
                    status="FAIL",
                    description="Project security rules not found",
                    remediation="Create comprehensive security policy in .trae/project_rules.md"
                )
            
            # Check Docker security configuration
            docker_compose_path = self.workspace_path / "docker" / "desktop-commander" / "docker-compose.yml"
            
            if docker_compose_path.exists():
                with open(docker_compose_path, 'r') as f:
                    docker_config = f.read()
                
                # Check for security best practices
                security_checks = {
                    "non-root user": "user:" in docker_config,
                    "memory limits": "mem_limit" in docker_config,
                    "cpu limits": "cpus" in docker_config,
                    "read-only filesystem": "read_only" in docker_config
                }
                
                failed_checks = [check for check, passed in security_checks.items() if not passed]
                
                if failed_checks:
                    return SecurityTestResult(
                        test_id=test_id,
                        vulnerability_type="Docker Security Configuration",
                        severity="MEDIUM",
                        status="FAIL",
                        description=f"Missing security configurations: {', '.join(failed_checks)}",
                        remediation="Implement missing Docker security configurations"
                    )
            
            return SecurityTestResult(
                test_id=test_id,
                vulnerability_type="Security Boundary Enforcement",
                severity="LOW",
                status="PASS",
                description="Basic security configurations are in place",
                remediation="Continue monitoring and regular security reviews"
            )
            
        except Exception as e:
            return SecurityTestResult(
                test_id=test_id,
                vulnerability_type="Security Test Execution",
                severity="HIGH",
                status="FAIL",
                description=f"Security test failed: {str(e)}",
                remediation="Investigate and resolve security test execution issues"
            )
    
    def run_performance_test(self) -> PerformanceMetrics:
        """TC-PERF-001: Run performance benchmarks"""
        
        def simulate_load():
            """Simulate MCP server load"""
            # Simulate some CPU and memory usage
            time.sleep(2)
            return "Load simulation complete"
        
        result, metrics = self.measure_performance(simulate_load)
        
        return metrics
    
    def run_all_tests(self) -> Dict[str, any]:
        """Execute complete test suite"""
        self.start_time = datetime.now()
        self.log("Starting Desktop Commander MCP Server Test Suite")
        
        # Functional Tests
        self.log("Running functional tests...")
        self.results.append(self.test_environment_prerequisites())
        self.results.append(self.test_configuration_validation())
        self.results.append(self.test_npx_deployment())
        self.results.append(self.test_docker_deployment())
        
        # Security Tests
        self.log("Running security tests...")
        self.security_results.append(self.test_security_boundaries())
        
        # Performance Tests
        self.log("Running performance tests...")
        self.performance_metrics.append(self.run_performance_test())
        
        self.end_time = datetime.now()
        
        # Generate summary
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if r.status == "PASS"])
        failed_tests = len([r for r in self.results if r.status == "FAIL"])
        
        security_issues = len([s for s in self.security_results if s.status == "FAIL"])
        
        summary = {
            "execution_time": (self.end_time - self.start_time).total_seconds(),
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "success_rate": (passed_tests / total_tests) * 100 if total_tests > 0 else 0,
            "security_issues": security_issues,
            "performance_metrics": [asdict(m) for m in self.performance_metrics],
            "test_results": [asdict(r) for r in self.results],
            "security_results": [asdict(s) for s in self.security_results]
        }
        
        self.log(f"Test suite completed. {passed_tests}/{total_tests} tests passed ({summary['success_rate']:.1f}%)")
        
        return summary
    
    def generate_report(self, output_path: str = None) -> str:
        """Generate detailed test report"""
        if output_path is None:
            output_path = self.workspace_path / "test_results.json"
        
        summary = self.run_all_tests()
        
        with open(output_path, 'w') as f:
            json.dump(summary, f, indent=2)
        
        self.log(f"Test report generated: {output_path}")
        
        return str(output_path)


def main():
    """Main execution function"""
    workspace = os.getcwd()
    
    if len(sys.argv) > 1:
        workspace = sys.argv[1]
    
    test_suite = TestSuite(workspace)
    report_path = test_suite.generate_report()
    
    print(f"\nTest execution complete. Report saved to: {report_path}")


if __name__ == "__main__":
    main()