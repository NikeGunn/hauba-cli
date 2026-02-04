# 🔧 Hauba CLI - Developer Tool

> Command-line interface for building, testing, and deploying Hauba AI agents and skills.

## 📦 Installation

```bash
cd tools/cli
pnpm install
pnpm build

# Install globally (optional)
npm link
```

## 🚀 Quick Start

```bash
# Check CLI is working
hauba --help

# Login to Hauba platform
hauba login

# Generate a skill using AI (Phase 5 - NEW!)
hauba skill generate -d "A skill that summarizes long articles"

# Or create skill from template
hauba skill init my-awesome-skill

# Deploy an agent
hauba deploy
```

---

## 📚 Commands

### 🔐 Authentication

```bash
# Login with email/password
hauba login
hauba login -e user@example.com

# Login with API token (CI/CD)
hauba login -t hauba_abc123...

# Check current user
hauba whoami
hauba whoami --json

# Logout
hauba logout
```

---

### 🧠 AI Skill Generation (Phase 5 - VIRAL FEATURE)

**Generate skills using natural language!**

```bash
# Quick generation
hauba skill generate -d "Monitor HackerNews for AI posts"

# Interactive mode with examples
hauba skill generate -i

# Specify category
hauba skill generate -d "Translate messages" -c communication

# Save to local directory (for editing)
hauba skill generate -d "Weather checker" --save

# Custom API URL
hauba skill generate -d "Task manager" --api-url https://api.hauba.tech
```

**Examples:**

```bash
# Productivity skill
hauba skill gen -d "Extract action items from meeting notes and create tasks"

# Analytics skill
hauba skill gen -d "Track GitHub stars for my repositories daily"

# Automation skill
hauba skill gen -d "Auto-reply to emails mentioning 'urgent' with priority flag"
```

**What happens:**
1. 🤖 AI (Claude/GPT) generates TypeScript code
2. 🔒 Security validation (blocks eval, require, etc.)
3. ✅ Code improvement cycle
4. 💾 Saves to your Hauba workspace
5. ✨ Ready to test immediately!

---

### 🛠️ Manual Skill Development

**For developers who want full control:**

```bash
# Create skill from template
hauba skill init weather-checker
hauba skill init my-skill -c productivity

# Development server
cd weather-checker
pnpm install
hauba skill dev
hauba skill dev -p 3002

# Build for production
hauba skill build

# Run tests
hauba skill test
hauba skill test --watch

# Validate skill structure
hauba skill validate

# Publish to marketplace
hauba skill publish
hauba skill publish --unlisted
hauba skill publish --dry-run
```

---

### 🏗️ Project Initialization

```bash
# Create new Hauba project
hauba init my-agent
hauba init my-project -t skill
hauba init full-project -t full -y

# Templates:
# - agent:  Full AI agent project
# - skill:  Installable skill package
# - full:   Complete project with all features
```

---

### 🚀 Deployment

```bash
# Deploy to development
hauba deploy

# Deploy to production
hauba deploy --prod
hauba deploy -e production -r us-east-1

# Dry run (simulate)
hauba deploy --dry-run

# Skip confirmations
hauba deploy --prod -y
```

---

## 📖 Use Cases

### When to use `hauba skill generate` (AI):
✅ Quick prototyping  
✅ Learning Hauba SDK  
✅ Non-developers building skills  
✅ Common use cases (summarize, extract, notify)  
✅ Rapid MVP development  

### When to use `hauba skill init` (Template):
✅ Complex custom logic  
✅ External API integrations  
✅ Performance-critical code  
✅ Team collaboration (version control)  
✅ Advanced TypeScript features  

---

## 🎯 Typical Workflow

### 1. **Quick Skill (AI-Generated)**

```bash
# Generate
hauba skill generate -d "Summarize long Slack threads"

# Test in dashboard
# (Opens https://app.hauba.tech)

# Use immediately!
```

### 2. **Production Skill (Manual)**

```bash
# Create from template
hauba skill init slack-summarizer

# Develop locally
cd slack-summarizer
pnpm install
hauba skill dev

# Write code in src/index.ts
# Write tests in tests/

# Build & validate
hauba skill build
hauba skill test
hauba skill validate

# Publish
hauba skill publish
```

---

## 🔑 Environment Variables

Create `.env` in your project or set globally:

```bash
# Hauba API URL
HAUBA_API_URL=http://localhost:3001  # Development
HAUBA_API_URL=https://api.hauba.tech # Production

# AI Provider (optional - uses platform keys by default)
DEFAULT_AI_MODEL=gemini-2.0-flash    # Free for development!
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
GOOGLE_AI_API_KEY=AIzaSy...
```

---

## 🧪 Testing AI Generation Locally

```bash
# 1. Start Hauba API server
cd ../../hauba
pnpm --filter @hauba/api dev

# 2. Login to CLI
hauba login -e test@hauba.dev

# 3. Generate skill
hauba skill generate -d "Count words in messages"

# 4. Check dashboard
# Skill appears in http://localhost:5173
```

---

## 🛡️ Security (Phase 5)

AI-generated skills are **validated** before execution:

**Blocked patterns:**
- `eval()` - Dynamic code execution
- `Function()` - Constructor execution  
- `require()` - Arbitrary module loading
- `process.env` - Environment access
- `child_process` - Shell commands
- `fs` - File system access
- `vm` - Virtual machine
- `__proto__` - Prototype pollution

**Status:**
- Generated skills: `private` (only you can use)
- Published skills: `approved` (reviewed & public)

---

## 📦 Package Structure

```
tools/cli/
├── bin/
│   └── hauba.js          # CLI entry point
├── src/
│   ├── index.ts          # Main CLI setup
│   └── commands/
│       ├── generate.ts   # AI skill generation (Phase 5)
│       ├── skill.ts      # Skill management
│       ├── init.ts       # Project initialization
│       ├── login.ts      # Authentication
│       └── deploy.ts     # Deployment
├── package.json
└── tsconfig.json
```

---

## 🐛 Troubleshooting

### "Not authenticated"
```bash
hauba login
```

### "API connection failed"
```bash
# Check API server is running
cd hauba
pnpm --filter @hauba/api dev

# Verify URL
echo $HAUBA_API_URL  # Should be http://localhost:3001
```

### "Skill generation failed"
```bash
# Check AI provider keys in API server
cd hauba
cat apps/api/.env | grep API_KEY

# Try with --api-url flag
hauba skill generate -d "test" --api-url http://localhost:3001
```

### "Command not found: hauba"
```bash
# Rebuild CLI
cd tools/cli
pnpm build

# Re-link globally
npm link
```

---

## 🎓 Examples

### Example 1: Email Summarizer

```bash
hauba skill generate -d "Summarize inbox emails and highlight action items"
```

### Example 2: Code Reviewer

```bash
hauba skill generate -i

# Interactive prompts:
# What should this skill do?
# > Review pull requests and suggest improvements

# Add examples?
# > Yes

# Example 1 - Input:
# > Pull request with 50 lines of Python code

# Example 1 - Output:
# > List of code quality suggestions and security checks
```

### Example 3: Deployment

```bash
# Generate
hauba skill gen -d "Daily standup reminder at 9am"

# Test
# (Tests in dashboard)

# Publish
hauba skill publish <skill-id>

# Deploy to agent
hauba agent add-skill <agent-id> <skill-id>
```

---

## 🔗 Links

- **Hauba Docs**: https://docs.hauba.tech
- **Skill Marketplace**: https://marketplace.hauba.tech
- **Dashboard**: https://app.hauba.tech
- **API Reference**: https://docs.hauba.tech/api

---

## 📝 License

MIT

---

## 🚀 What's New in Phase 5

✨ **AI Skill Generation**
- Natural language → TypeScript code
- Powered by Claude Sonnet 4 / GPT-4
- Security validation built-in
- Test cases auto-generated
- Instant deployment to workspace

**Try it now:**
```bash
hauba skill generate -d "Your idea here!"
```
