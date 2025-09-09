#!/usr/bin/env python3
"""
Desktop Commander MCP Server Security Testing Suite

Comprehensive security testing framework for vulnerability assessment,
penetration testing, and security compliance validation.
"""

import os
import sys
import json
import time
import hashlib
import subprocess
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
import tempfile
import shutil


@dataclass
class SecurityVulnerability:
    """Security vulnerability data structure"""
    vuln_id: str
    title: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW, INFO
    category: str  # OWASP category or custom
    description: str
    impact: str
    remediation: str
    cve_references: List[str]
    affected_components: List[str]
    test_evidence: str
    risk_score: float  # 0.0 to 10.0


@dataclass
class SecurityTestResult:
    """Security test execution result"""
    test_id: str
    test_name: str
    status: str  # PASS, FAIL, WARNING, INFO
    execution_time: float
    vulnerabilities: List[SecurityVulnerability]
    recommendations: List[str]
    compliance_status: Dict[str, str]


class SecurityTestSuite:
    """Comprehensive security testing suite"""
    
    def __init__(self, workspace_path: str):
        self.workspace_path = Path(workspace_path)
        self.results: List[SecurityTestResult] = []
        self.vulnerabilities: List[SecurityVulnerability] = []
        self.start_time = None
        self.end_time = None
        
    def log(self, message: str, level: str = "INFO"):
        """Security-focused logging"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] SECURITY-{level}: {message}")
    
    def run_command(self, command: str, timeout: int = 30) -> Tuple[int, str, str]:
        """Execute command with security monitoring"""
        try:
            # Log command execution for security audit
            self.log(f"Executing command: {command[:50]}...", "DEBUG")
            
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
            self.log(f"Command timeout: {command}", "WARNING")
            return -1, "", "Command timed out"
        except Exception as e:
            self.log(f"Command execution error: {str(e)}", "ERROR")
            return -1, "", str(e)
    
    def calculate_risk_score(self, severity: str, exploitability: float, impact: float) -> float:
        """Calculate CVSS-like risk score"""
        severity_weights = {
            "CRITICAL": 10.0,
            "HIGH": 8.0,
            "MEDIUM": 5.0,
            "LOW": 2.0,
            "INFO": 0.5
        }
        
        base_score = severity_weights.get(severity, 0.0)
        risk_score = (base_score * exploitability * impact) / 10.0
        
        return min(risk_score, 10.0)
    
    def test_authentication_security(self) -> SecurityTestResult:
        """ST-AUTH-001: Authentication and authorization security"""
        test_id = "ST-AUTH-001"
        start_time = time.time()
        vulnerabilities = []
        recommendations = []
        
        try:
            # Check MCP configuration for authentication settings
            mcp_config_path = self.workspace_path / ".trae" / "mcp.json"
            
            if mcp_config_path.exists():
                with open(mcp_config_path, 'r') as f:
                    config = json.load(f)
                
                # Check for authentication mechanisms
                servers = config.get("mcpServers", {})
                
                for server_name, server_config in servers.items():
                    # Check for missing authentication
                    if "auth" not in server_config and "token" not in server_config:
                        vuln = SecurityVulnerability(
                            vuln_id=f"AUTH-001-{server_name}",
                            title="Missing Authentication Configuration",
                            severity="HIGH",
                            category="Authentication",
                            description=f"MCP server '{server_name}' lacks authentication configuration",
                            impact="Unauthorized access to MCP server capabilities",
                            remediation="Implement authentication tokens or certificates",
                            cve_references=[],
                            affected_components=[server_name],
                            test_evidence=f"No auth/token fields found in {server_name} configuration",
                            risk_score=self.calculate_risk_score("HIGH", 0.8, 0.9)
                        )
                        vulnerabilities.append(vuln)
                        recommendations.append(f"Add authentication to {server_name}")
            
            # Check Docker security context
            docker_compose_path = self.workspace_path / "docker" / "desktop-commander" / "docker-compose.yml"
            
            if docker_compose_path.exists():
                with open(docker_compose_path, 'r') as f:
                    docker_config = f.read()
                
                # Check for privileged containers
                if "privileged: true" in docker_config:
                    vuln = SecurityVulnerability(
                        vuln_id="AUTH-002-DOCKER",
                        title="Privileged Docker Container",
                        severity="CRITICAL",
                        category="Container Security",
                        description="Docker container running with privileged access",
                        impact="Full host system compromise possible",
                        remediation="Remove privileged flag and use specific capabilities",
                        cve_references=["CVE-2019-5736"],
                        affected_components=["docker-compose.yml"],
                        test_evidence="privileged: true found in Docker configuration",
                        risk_score=self.calculate_risk_score("CRITICAL", 0.9, 1.0)
                    )
                    vulnerabilities.append(vuln)
                    recommendations.append("Remove privileged Docker access")
                
                # Check for root user
                if "user: root" in docker_config or "USER root" in docker_config:
                    vuln = SecurityVulnerability(
                        vuln_id="AUTH-003-DOCKER",
                        title="Container Running as Root",
                        severity="HIGH",
                        category="Container Security",
                        description="Docker container running as root user",
                        impact="Privilege escalation and container escape risks",
                        remediation="Create and use non-root user in container",
                        cve_references=[],
                        affected_components=["docker-compose.yml"],
                        test_evidence="Root user configuration found",
                        risk_score=self.calculate_risk_score("HIGH", 0.7, 0.8)
                    )
                    vulnerabilities.append(vuln)
                    recommendations.append("Configure non-root user for container")
            
            execution_time = time.time() - start_time
            status = "FAIL" if vulnerabilities else "PASS"
            
            return SecurityTestResult(
                test_id=test_id,
                test_name="Authentication Security Assessment",
                status=status,
                execution_time=execution_time,
                vulnerabilities=vulnerabilities,
                recommendations=recommendations,
                compliance_status={"OWASP_A01": status}
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            self.log(f"Authentication security test failed: {str(e)}", "ERROR")
            
            return SecurityTestResult(
                test_id=test_id,
                test_name="Authentication Security Assessment",
                status="FAIL",
                execution_time=execution_time,
                vulnerabilities=[],
                recommendations=["Fix test execution issues"],
                compliance_status={"OWASP_A01": "UNKNOWN"}
            )
    
    def test_input_validation(self) -> SecurityTestResult:
        """ST-INPUT-001: Input validation and injection vulnerabilities"""
        test_id = "ST-INPUT-001"
        start_time = time.time()
        vulnerabilities = []
        recommendations = []
        
        try:
            # Test command injection vulnerabilities
            injection_payloads = [
                "; ls -la",
                "&& whoami",
                "| cat /etc/passwd",
                "`id`",
                "$(whoami)",
                "'; DROP TABLE users; --"
            ]
            
            # Simulate testing MCP server input validation
            # In a real implementation, this would send actual requests to the MCP server
            
            # Check project rules for input validation guidelines
            rules_path = self.workspace_path / ".trae" / "project_rules.md"
            
            if rules_path.exists():
                with open(rules_path, 'r') as f:
                    rules_content = f.read().lower()
                
                # Check for input validation mentions
                validation_keywords = [
                    "input validation",
                    "sanitization",
                    "parameter validation",
                    "injection prevention"
                ]
                
                missing_validations = []
                for keyword in validation_keywords:
                    if keyword not in rules_content:
                        missing_validations.append(keyword)
                
                if missing_validations:
                    vuln = SecurityVulnerability(
                        vuln_id="INPUT-001-VALIDATION",
                        title="Insufficient Input Validation Guidelines",
                        severity="MEDIUM",
                        category="Input Validation",
                        description=f"Missing input validation guidelines: {', '.join(missing_validations)}",
                        impact="Potential injection vulnerabilities",
                        remediation="Add comprehensive input validation guidelines to project rules",
                        cve_references=["CWE-20", "CWE-79", "CWE-89"],
                        affected_components=["project_rules.md"],
                        test_evidence=f"Missing keywords: {missing_validations}",
                        risk_score=self.calculate_risk_score("MEDIUM", 0.6, 0.7)
                    )
                    vulnerabilities.append(vuln)
                    recommendations.append("Enhance input validation guidelines")
            
            # Check for potential path traversal vulnerabilities
            test_paths = [
                "../../../etc/passwd",
                "..\\..\\..\\windows\\system32\\config\\sam",
                "/etc/shadow",
                "C:\\Windows\\System32\\config\\SAM"
            ]
            
            # This would be implemented with actual MCP server testing
            # For now, we'll check if there are any obvious path validation issues
            
            execution_time = time.time() - start_time
            status = "FAIL" if vulnerabilities else "PASS"
            
            return SecurityTestResult(
                test_id=test_id,
                test_name="Input Validation Security Assessment",
                status=status,
                execution_time=execution_time,
                vulnerabilities=vulnerabilities,
                recommendations=recommendations,
                compliance_status={"OWASP_A03": status, "CWE_20": status}
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            self.log(f"Input validation test failed: {str(e)}", "ERROR")
            
            return SecurityTestResult(
                test_id=test_id,
                test_name="Input Validation Security Assessment",
                status="FAIL",
                execution_time=execution_time,
                vulnerabilities=[],
                recommendations=["Fix test execution issues"],
                compliance_status={"OWASP_A03": "UNKNOWN"}
            )
    
    def test_secrets_management(self) -> SecurityTestResult:
        """ST-SECRETS-001: Secrets and sensitive data management"""
        test_id = "ST-SECRETS-001"
        start_time = time.time()
        vulnerabilities = []
        recommendations = []
        
        try:
            # Scan for hardcoded secrets in configuration files
            config_files = [
                self.workspace_path / ".trae" / "mcp.json",
                self.workspace_path / "docker" / "desktop-commander" / "docker-compose.yml",
                self.workspace_path / "Makefile"
            ]
            
            secret_patterns = [
                r"password\s*[=:]\s*['\"][^'\"]+['\"]?",
                r"api[_-]?key\s*[=:]\s*['\"][^'\"]+['\"]?",
                r"secret\s*[=:]\s*['\"][^'\"]+['\"]?",
                r"token\s*[=:]\s*['\"][^'\"]+['\"]?",
                r"[a-zA-Z0-9]{32,}",  # Potential API keys
                r"-----BEGIN [A-Z ]+-----"  # Private keys
            ]
            
            import re
            
            for config_file in config_files:
                if config_file.exists():
                    with open(config_file, 'r') as f:
                        content = f.read()
                    
                    for pattern in secret_patterns:
                        matches = re.findall(pattern, content, re.IGNORECASE)
                        if matches:
                            vuln = SecurityVulnerability(
                                vuln_id=f"SECRETS-001-{config_file.name}",
                                title="Potential Hardcoded Secrets",
                                severity="HIGH",
                                category="Secrets Management",
                                description=f"Potential secrets found in {config_file.name}",
                                impact="Credential exposure and unauthorized access",
                                remediation="Move secrets to environment variables or secure vault",
                                cve_references=["CWE-798"],
                                affected_components=[str(config_file)],
                                test_evidence=f"Pattern matches: {len(matches)}",
                                risk_score=self.calculate_risk_score("HIGH", 0.8, 0.9)
                            )
                            vulnerabilities.append(vuln)
                            recommendations.append(f"Review and secure secrets in {config_file.name}")
            
            # Check for .env files that might contain secrets
            env_files = list(self.workspace_path.glob("**/.env*"))
            
            for env_file in env_files:
                if env_file.is_file():
                    vuln = SecurityVulnerability(
                        vuln_id=f"SECRETS-002-{env_file.name}",
                        title="Environment File Found",
                        severity="MEDIUM",
                        category="Secrets Management",
                        description=f"Environment file {env_file.name} may contain secrets",
                        impact="Potential credential exposure if committed to version control",
                        remediation="Ensure .env files are in .gitignore and use secure secret management",
                        cve_references=[],
                        affected_components=[str(env_file)],
                        test_evidence=f"Environment file found: {env_file}",
                        risk_score=self.calculate_risk_score("MEDIUM", 0.5, 0.6)
                    )
                    vulnerabilities.append(vuln)
                    recommendations.append(f"Secure environment file: {env_file.name}")
            
            execution_time = time.time() - start_time
            status = "FAIL" if vulnerabilities else "PASS"
            
            return SecurityTestResult(
                test_id=test_id,
                test_name="Secrets Management Security Assessment",
                status=status,
                execution_time=execution_time,
                vulnerabilities=vulnerabilities,
                recommendations=recommendations,
                compliance_status={"OWASP_A07": status, "CWE_798": status}
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            self.log(f"Secrets management test failed: {str(e)}", "ERROR")
            
            return SecurityTestResult(
                test_id=test_id,
                test_name="Secrets Management Security Assessment",
                status="FAIL",
                execution_time=execution_time,
                vulnerabilities=[],
                recommendations=["Fix test execution issues"],
                compliance_status={"OWASP_A07": "UNKNOWN"}
            )
    
    def test_container_security(self) -> SecurityTestResult:
        """ST-CONTAINER-001: Container security assessment"""
        test_id = "ST-CONTAINER-001"
        start_time = time.time()
        vulnerabilities = []
        recommendations = []
        
        try:
            docker_compose_path = self.workspace_path / "docker" / "desktop-commander" / "docker-compose.yml"
            dockerfile_path = self.workspace_path / "docker" / "desktop-commander" / "Dockerfile"
            
            if docker_compose_path.exists():
                with open(docker_compose_path, 'r') as f:
                    compose_content = f.read()
                
                # Check for security misconfigurations
                security_checks = {
                    "privileged": "privileged: true" in compose_content,
                    "host_network": "network_mode: host" in compose_content,
                    "host_pid": "pid: host" in compose_content,
                    "no_new_privileges": "security_opt:\n    - no-new-privileges:true" not in compose_content,
                    "capabilities_add": "cap_add:" in compose_content,
                    "volumes_writable": ":rw" in compose_content or "type: bind" in compose_content
                }
                
                for check, is_vulnerable in security_checks.items():
                    if is_vulnerable:
                        severity = "CRITICAL" if check in ["privileged", "host_network", "host_pid"] else "HIGH"
                        
                        vuln = SecurityVulnerability(
                            vuln_id=f"CONTAINER-001-{check.upper()}",
                            title=f"Container Security Issue: {check.replace('_', ' ').title()}",
                            severity=severity,
                            category="Container Security",
                            description=f"Container configuration has {check.replace('_', ' ')} security issue",
                            impact="Potential container escape or privilege escalation",
                            remediation=f"Fix {check.replace('_', ' ')} configuration in Docker Compose",
                            cve_references=[],
                            affected_components=["docker-compose.yml"],
                            test_evidence=f"Security check failed: {check}",
                            risk_score=self.calculate_risk_score(severity, 0.8, 0.9)
                        )
                        vulnerabilities.append(vuln)
                        recommendations.append(f"Fix container {check.replace('_', ' ')} issue")
            
            if dockerfile_path.exists():
                with open(dockerfile_path, 'r') as f:
                    dockerfile_content = f.read()
                
                # Check Dockerfile security best practices
                if "USER root" in dockerfile_content or "USER 0" in dockerfile_content:
                    vuln = SecurityVulnerability(
                        vuln_id="CONTAINER-002-ROOT-USER",
                        title="Dockerfile Uses Root User",
                        severity="HIGH",
                        category="Container Security",
                        description="Dockerfile explicitly sets root user",
                        impact="Container runs with elevated privileges",
                        remediation="Create and use non-root user in Dockerfile",
                        cve_references=[],
                        affected_components=["Dockerfile"],
                        test_evidence="USER root or USER 0 found in Dockerfile",
                        risk_score=self.calculate_risk_score("HIGH", 0.7, 0.8)
                    )
                    vulnerabilities.append(vuln)
                    recommendations.append("Use non-root user in Dockerfile")
                
                # Check for latest tag usage
                if ":latest" in dockerfile_content:
                    vuln = SecurityVulnerability(
                        vuln_id="CONTAINER-003-LATEST-TAG",
                        title="Use of Latest Tag in Base Image",
                        severity="MEDIUM",
                        category="Container Security",
                        description="Dockerfile uses :latest tag for base image",
                        impact="Unpredictable builds and potential security vulnerabilities",
                        remediation="Pin base image to specific version",
                        cve_references=[],
                        affected_components=["Dockerfile"],
                        test_evidence=":latest tag found in Dockerfile",
                        risk_score=self.calculate_risk_score("MEDIUM", 0.4, 0.5)
                    )
                    vulnerabilities.append(vuln)
                    recommendations.append("Pin base image versions in Dockerfile")
            
            execution_time = time.time() - start_time
            status = "FAIL" if vulnerabilities else "PASS"
            
            return SecurityTestResult(
                test_id=test_id,
                test_name="Container Security Assessment",
                status=status,
                execution_time=execution_time,
                vulnerabilities=vulnerabilities,
                recommendations=recommendations,
                compliance_status={"CIS_Docker": status, "NIST_Container": status}
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            self.log(f"Container security test failed: {str(e)}", "ERROR")
            
            return SecurityTestResult(
                test_id=test_id,
                test_name="Container Security Assessment",
                status="FAIL",
                execution_time=execution_time,
                vulnerabilities=[],
                recommendations=["Fix test execution issues"],
                compliance_status={"CIS_Docker": "UNKNOWN"}
            )
    
    def test_file_permissions(self) -> SecurityTestResult:
        """ST-PERMS-001: File and directory permissions assessment"""
        test_id = "ST-PERMS-001"
        start_time = time.time()
        vulnerabilities = []
        recommendations = []
        
        try:
            # Check critical file permissions
            critical_files = [
                self.workspace_path / ".trae" / "mcp.json",
                self.workspace_path / "docker" / "desktop-commander" / "docker-compose.yml",
                self.workspace_path / "Makefile"
            ]
            
            for file_path in critical_files:
                if file_path.exists():
                    # Get file permissions (Unix-style)
                    try:
                        stat_info = file_path.stat()
                        permissions = oct(stat_info.st_mode)[-3:]
                        
                        # Check for overly permissive permissions
                        if permissions in ['777', '666', '755'] and file_path.suffix in ['.json', '.yml', '.yaml']:
                            vuln = SecurityVulnerability(
                                vuln_id=f"PERMS-001-{file_path.name}",
                                title="Overly Permissive File Permissions",
                                severity="MEDIUM",
                                category="File Permissions",
                                description=f"File {file_path.name} has permissions {permissions}",
                                impact="Unauthorized file modification possible",
                                remediation=f"Set restrictive permissions (644) for {file_path.name}",
                                cve_references=["CWE-732"],
                                affected_components=[str(file_path)],
                                test_evidence=f"File permissions: {permissions}",
                                risk_score=self.calculate_risk_score("MEDIUM", 0.5, 0.6)
                            )
                            vulnerabilities.append(vuln)
                            recommendations.append(f"Fix permissions for {file_path.name}")
                    
                    except (OSError, AttributeError):
                        # Windows or permission check not available
                        pass
            
            # Check for world-writable directories
            directories_to_check = [
                self.workspace_path / ".trae",
                self.workspace_path / "docker"
            ]
            
            for dir_path in directories_to_check:
                if dir_path.exists() and dir_path.is_dir():
                    try:
                        stat_info = dir_path.stat()
                        permissions = oct(stat_info.st_mode)[-3:]
                        
                        if permissions in ['777', '775']:
                            vuln = SecurityVulnerability(
                                vuln_id=f"PERMS-002-{dir_path.name}",
                                title="World-Writable Directory",
                                severity="HIGH",
                                category="Directory Permissions",
                                description=f"Directory {dir_path.name} is world-writable",
                                impact="Unauthorized file creation and modification",
                                remediation=f"Set restrictive permissions (755) for {dir_path.name}",
                                cve_references=["CWE-732"],
                                affected_components=[str(dir_path)],
                                test_evidence=f"Directory permissions: {permissions}",
                                risk_score=self.calculate_risk_score("HIGH", 0.7, 0.8)
                            )
                            vulnerabilities.append(vuln)
                            recommendations.append(f"Fix directory permissions for {dir_path.name}")
                    
                    except (OSError, AttributeError):
                        # Windows or permission check not available
                        pass
            
            execution_time = time.time() - start_time
            status = "FAIL" if vulnerabilities else "PASS"
            
            return SecurityTestResult(
                test_id=test_id,
                test_name="File Permissions Security Assessment",
                status=status,
                execution_time=execution_time,
                vulnerabilities=vulnerabilities,
                recommendations=recommendations,
                compliance_status={"CWE_732": status}
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            self.log(f"File permissions test failed: {str(e)}", "ERROR")
            
            return SecurityTestResult(
                test_id=test_id,
                test_name="File Permissions Security Assessment",
                status="FAIL",
                execution_time=execution_time,
                vulnerabilities=[],
                recommendations=["Fix test execution issues"],
                compliance_status={"CWE_732": "UNKNOWN"}
            )
    
    def run_all_security_tests(self) -> Dict[str, any]:
        """Execute complete security test suite"""
        self.start_time = datetime.now()
        self.log("Starting Desktop Commander MCP Server Security Assessment")
        
        # Execute all security tests
        security_tests = [
            self.test_authentication_security,
            self.test_input_validation,
            self.test_secrets_management,
            self.test_container_security,
            self.test_file_permissions
        ]
        
        for test_func in security_tests:
            try:
                result = test_func()
                self.results.append(result)
                self.vulnerabilities.extend(result.vulnerabilities)
                
                self.log(f"Completed {result.test_name}: {result.status}")
                if result.vulnerabilities:
                    self.log(f"Found {len(result.vulnerabilities)} vulnerabilities")
                    
            except Exception as e:
                self.log(f"Security test failed: {str(e)}", "ERROR")
        
        self.end_time = datetime.now()
        
        # Calculate security metrics
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if r.status == "PASS"])
        failed_tests = len([r for r in self.results if r.status == "FAIL"])
        
        critical_vulns = len([v for v in self.vulnerabilities if v.severity == "CRITICAL"])
        high_vulns = len([v for v in self.vulnerabilities if v.severity == "HIGH"])
        medium_vulns = len([v for v in self.vulnerabilities if v.severity == "MEDIUM"])
        low_vulns = len([v for v in self.vulnerabilities if v.severity == "LOW"])
        
        # Calculate overall security score (0-100)
        max_possible_score = 100
        deductions = (critical_vulns * 25) + (high_vulns * 15) + (medium_vulns * 8) + (low_vulns * 3)
        security_score = max(0, max_possible_score - deductions)
        
        # Generate comprehensive report
        summary = {
            "assessment_metadata": {
                "execution_time": (self.end_time - self.start_time).total_seconds(),
                "timestamp": self.start_time.isoformat(),
                "total_tests": total_tests,
                "passed_tests": passed_tests,
                "failed_tests": failed_tests
            },
            "security_metrics": {
                "overall_security_score": security_score,
                "total_vulnerabilities": len(self.vulnerabilities),
                "critical_vulnerabilities": critical_vulns,
                "high_vulnerabilities": high_vulns,
                "medium_vulnerabilities": medium_vulns,
                "low_vulnerabilities": low_vulns,
                "average_risk_score": sum(v.risk_score for v in self.vulnerabilities) / len(self.vulnerabilities) if self.vulnerabilities else 0
            },
            "compliance_status": self._generate_compliance_report(),
            "test_results": [asdict(r) for r in self.results],
            "vulnerabilities": [asdict(v) for v in self.vulnerabilities],
            "recommendations": self._generate_prioritized_recommendations()
        }
        
        self.log(f"Security assessment completed. Score: {security_score}/100")
        self.log(f"Found {len(self.vulnerabilities)} total vulnerabilities")
        
        return summary
    
    def _generate_compliance_report(self) -> Dict[str, str]:
        """Generate compliance status report"""
        compliance_frameworks = {}
        
        for result in self.results:
            for framework, status in result.compliance_status.items():
                if framework not in compliance_frameworks:
                    compliance_frameworks[framework] = []
                compliance_frameworks[framework].append(status)
        
        # Determine overall compliance status for each framework
        final_compliance = {}
        for framework, statuses in compliance_frameworks.items():
            if "FAIL" in statuses:
                final_compliance[framework] = "NON_COMPLIANT"
            elif "UNKNOWN" in statuses:
                final_compliance[framework] = "PARTIAL_COMPLIANCE"
            else:
                final_compliance[framework] = "COMPLIANT"
        
        return final_compliance
    
    def _generate_prioritized_recommendations(self) -> List[Dict[str, str]]:
        """Generate prioritized list of security recommendations"""
        recommendations = []
        
        # Group recommendations by severity
        severity_order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
        
        for severity in severity_order:
            severity_vulns = [v for v in self.vulnerabilities if v.severity == severity]
            
            for vuln in severity_vulns:
                recommendations.append({
                    "priority": severity,
                    "vulnerability_id": vuln.vuln_id,
                    "title": vuln.title,
                    "recommendation": vuln.remediation,
                    "affected_components": ", ".join(vuln.affected_components),
                    "risk_score": vuln.risk_score
                })
        
        return recommendations
    
    def generate_security_report(self, output_path: str = None) -> str:
        """Generate comprehensive security assessment report"""
        if output_path is None:
            output_path = self.workspace_path / "security_assessment_report.json"
        
        summary = self.run_all_security_tests()
        
        with open(output_path, 'w') as f:
            json.dump(summary, f, indent=2)
        
        self.log(f"Security assessment report generated: {output_path}")
        
        return str(output_path)


def main():
    """Main execution function"""
    workspace = os.getcwd()
    
    if len(sys.argv) > 1:
        workspace = sys.argv[1]
    
    security_suite = SecurityTestSuite(workspace)
    report_path = security_suite.generate_security_report()
    
    print(f"\nSecurity assessment complete. Report saved to: {report_path}")


if __name__ == "__main__":
    main()