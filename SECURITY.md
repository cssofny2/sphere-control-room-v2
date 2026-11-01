# Security Policy

## Supported versions

Only the latest release on `main` (deployed at https://lab.spheredesci.org) receives security fixes.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/cssofny2/sphere-control-room-v2/security/advisories/new)
rather than a public issue. Include steps to reproduce and the affected version.
You can expect an acknowledgement within a few days.

Never commit API keys or other secrets; the `api/` functions read them from environment variables.
