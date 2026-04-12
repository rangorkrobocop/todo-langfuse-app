## Setup Instructions

This repo requires Node.js version 22 or higher. Clone the repo and install the dependencies:

```bash
git clone https://github.com/stevekinney/full-stack-typescript.git
cd todo-langfuse-app
npm install
```

## Zod Exercises

To start the Zod exercise, `cd` into the `exercises/zod` directory and run the tests: `npm test zod-exercises.test`. Note: You'll need to remove the `todos` in the test when you begin the

## Todo API Application

To start the Todo application, both the client and server applications need to be started. VS Code users can use the provide `Start` task. Open the Command Palette > Run Task > Start. Alternatively, open two terminal tabs and run each project:

```bash
# Terminal 1: Client App
cd client
npm run dev

# Terminal 2: Server App
cd server
npm run dev
```

### Gemini Agent Feature

The application includes an integrated **AG-UI agent** that can perform task management. To enable it, you must configure your Gemini API Key.
1. Navigate to the `server/` directory.
2. Create a file named `.env`.
3. Add your key: `GEMINI_API_KEY=your_copied_api_key_here`. 
*(Note: Your environment variables are ignored by git to keep your key safe).*
