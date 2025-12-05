# JobScanAI
This tool is for scanning Visa Sponsored Jobs across the world and help in applying

## Hello World Backend POC

This is a proof of concept backend using Vercel serverless functions and GitHub Actions automation.

### Project Structure

```
jobscanai/
├── package.json              # Node.js dependencies and scripts
├── vercel.json              # Vercel deployment configuration
├── api/
│   ├── hello.js            # Simple Hello World endpoint
│   └── increment.js        # Counter increment endpoint (GET/POST)
├── .github/
│   └── workflows/
│       └── cron-increment.yml  # GitHub Actions cron job
└── README.md
```

### API Endpoints

#### `/api/hello`
- **Method**: GET
- **Description**: Returns a simple Hello World message with timestamp
- **Response**:
  ```json
  {
    "message": "Hello World!",
    "timestamp": "2025-01-12T11:16:00.000Z",
    "method": "GET"
  }
  ```

#### `/api/increment`
- **Methods**: GET, POST
- **Description**: Counter endpoint (Note: Uses in-memory storage, resets on cold starts)
- **GET**: Returns current counter value
- **POST**: Increments the counter and returns new value
- **Response**:
  ```json
  {
    "message": "Counter incremented",
    "counter": 5,
    "timestamp": "2025-01-12T11:16:00.000Z"
  }
  ```

### Setup & Deployment

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run locally**:
   ```bash
   npm run dev
   ```

3. **Deploy to Vercel**:
   ```bash
   npm run deploy
   ```

### GitHub Actions Configuration

The cron job (`.github/workflows/cron-increment.yml`) runs every hour to call the increment endpoint.

**Required Secret**:
- `API_URL`: Your deployed Vercel URL (e.g., `https://your-app.vercel.app`)

To add this secret:
1. Go to your GitHub repository settings
2. Navigate to Secrets and Variables > Actions
3. Add a new repository secret named `API_URL`

### Local Testing

Test the endpoints locally:

```bash
# Test hello endpoint
curl http://localhost:3000/api/hello

# Test increment GET
curl http://localhost:3000/api/increment

# Test increment POST
curl -X POST http://localhost:3000/api/increment
```
