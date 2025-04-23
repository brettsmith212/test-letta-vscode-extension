# Letta VS Code Extension Development Memory

## Project Structure
This project is a VS Code extension that integrates with the Letta agent framework. It replaces the original Claude-based AI chat functionality with Letta-powered capabilities.

## Important Commands
- `npm install` - Install dependencies (remember to do this after adding new dependencies)
- `npm run compile` - Compile TypeScript files
- `npm run watch` - Watch TypeScript files and compile on change
- `npm run build:webviews` - Build webview UI components
- `npm run watch:webviews` - Watch and build webview UI on change 
- `npm run start:letta` - Start the Letta container

## Progress Tracking
When you complete a step be sure to mark it completed in implementation.md as well.

### Completed
- [x] Step 1.1: Added Letta SDK and Docker CLI helper
  - Added `@letta/sdk` and `dockerode` dependencies
  - Created Docker helper utilities in `src/utils/dockerHelper.ts`
  - Added start:letta script to package.json

- [x] Step 1.2: Added VS Code settings schema
  - Extended package.json with `lettaChat.*` settings

### Next Steps
- [ ] Step 2.1: Create LettaService singleton
- [ ] Step 2.2: Implement workspace agent mapping
- [ ] Step 2.3: Register VS Code tools with Letta agent