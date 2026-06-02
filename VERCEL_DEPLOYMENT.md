# Vercel Deployment Guide

This document provides comprehensive instructions for deploying the Weather Frontend to Vercel.

## Prerequisites

- Node.js 20.x or higher
- npm or yarn package manager
- A Vercel account ([sign up here](https://vercel.com/signup))
- Git repository (GitHub, GitLab, or Bitbucket)

## Environment Variables

Before deploying, you need to configure environment variables in Vercel:

### Required Variables

1. **CLIMATE_BACKEND_URL** (Optional - has default)
   - The URL of your climate prediction backend API
   - Default: `https://weather-backend-2rfr.onrender.com`
   - Example: `https://api.yourcompany.com/climate`

See `.env.example` for all available environment variables.

## Deployment Options

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Connect Your Repository**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Select your Git provider (GitHub, GitLab, Bitbucket)
   - Authorize Vercel to access your repositories
   - Select the `weather-frontend` repository

2. **Configure Project Settings**
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: Leave as default (or specify `weather-frontend/` if the repo has multiple projects)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm ci` (auto-detected)

3. **Set Environment Variables**
   - In the "Environment Variables" section, add:
     - Key: `CLIMATE_BACKEND_URL`
     - Value: Your backend URL (or leave empty to use default)
   - Click "Add"

4. **Deploy**
   - Click the "Deploy" button
   - Vercel will build and deploy your application
   - Your site will be live at `your-project-name.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Authenticate**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   cd weather-frontend
   vercel
   ```

4. **Set Environment Variables**
   - Follow the prompts during deployment
   - Or set them later in the Vercel dashboard

### Option 3: Deploy via GitHub/GitLab/Bitbucket (Auto-deploy)

Once connected to Vercel:
- Every push to the main/master branch automatically triggers a deployment
- Pull requests get preview deployments
- Configure branch-specific settings in Vercel dashboard

## Vercel Configuration

The `vercel.json` file contains:

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "nodeVersion": "20.x",
  "env": {
    "CLIMATE_BACKEND_URL": "@climate_backend_url"
  },
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30,
      "memory": 512
    }
  }
}
```

### Configuration Explanations

- **buildCommand**: Runs the Next.js build process
- **installCommand**: Uses `npm ci` for consistent dependencies
- **framework**: Enables Next.js optimizations
- **nodeVersion**: Specifies Node.js 20.x runtime
- **functions**: API routes have 30-second timeout and 512MB memory limit
  - Adjust `maxDuration` if your backend requests take longer
  - Adjust `memory` for heavier computations

## Post-Deployment

### 1. Verify the Deployment

- Visit your deployment URL
- Test the weather search functionality
- Check browser console for any errors
- Verify API calls work correctly

### 2. Monitor Performance

- Use Vercel Analytics dashboard to monitor:
  - Deployment status
  - Function execution times
  - Error rates
  - User metrics

### 3. Set Up Custom Domain (Optional)

1. Go to your Vercel project settings
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

### 4. Configure Production Behavior

In Vercel dashboard → Settings → Git:
- Enable automatic deployments
- Configure protected branches
- Set branch naming conventions

## Troubleshooting

### Build Fails

**Error**: `npm ERR! 404 Not Found`
- Ensure all dependencies are published
- Check `package.json` for typos
- Run `npm ci` locally to verify

**Error**: `Cannot find module`
- Verify TypeScript paths are correct
- Check `.env.example` for required variables
- Ensure all files are committed to git

### Runtime Errors

**Error**: `CLIMATE_BACKEND_URL is undefined`
- Add the environment variable in Vercel dashboard
- Ensure backend service is accessible from Vercel (check CORS)
- Verify the backend URL is correct

**Error**: `Function timed out`
- Backend is taking too long to respond
- Increase `maxDuration` in `vercel.json`
- Optimize backend queries
- Check network connectivity

### API Routes Fail

1. Check function logs in Vercel dashboard:
   - Project → Deployments → View Details → Functions
2. Verify environment variables are set
3. Test API endpoints with curl:
   ```bash
   curl https://your-domain.vercel.app/api/weather?query=London
   curl https://your-domain.vercel.app/api/predict?city=London
   ```

## Performance Optimization

### Current Setup

- ✅ Next.js 16.2.4 (latest)
- ✅ React 19.2.4 (latest)
- ✅ TypeScript strict mode
- ✅ Tailwind CSS for minimal CSS
- ✅ Image optimization via Next.js
- ✅ API route revalidation for caching

### Recommended Optimizations

1. **Enable Incremental Static Regeneration (ISR)**
   ```typescript
   export const revalidate = 3600; // Revalidate every hour
   ```

2. **Add Image Optimization**
   - Use Next.js `Image` component for weather icons
   - Configure image domains in `next.config.ts`

3. **Enable Compression**
   - Already handled by Vercel/Next.js

4. **Monitor Core Web Vitals**
   - Use Vercel Analytics
   - Monitor Largest Contentful Paint (LCP)
   - Optimize Cumulative Layout Shift (CLS)

## Rollback

If a deployment has issues:

1. Go to Vercel dashboard → Deployments
2. Find the previous stable deployment
3. Click the three dots → "Promote to Production"
4. Confirm the rollback

## CI/CD Pipeline

The project is ready for CI/CD with:

```yaml
# Automatic on every push
- ESLint linting
- TypeScript compilation
- Next.js build
- Vercel deployment
```

No additional CI/CD setup needed with Vercel.

## Important Notes

1. **Leaflet Library**: The project uses Leaflet for maps. Ensure `@types/leaflet` is compatible.
2. **External APIs**: The app calls:
   - `https://geocoding-api.open-meteo.com/v1/search` (no auth required)
   - `https://api.open-meteo.com/v1/forecast` (no auth required)
   - Your custom backend API (requires CLIMATE_BACKEND_URL)
3. **Timeouts**: API routes have 30-second timeouts configured for long-running requests.

## Support

For issues, check:
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [GitHub Issues](link-to-your-repo)

---

**Last Updated**: 2026-06-02
**Framework**: Next.js 16.2.4
**Node Version**: 20.x
