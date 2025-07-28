# 🏠 LeaseGuard - AI-Powered Tenant Rights Assistant

**Redis-Powered AI Assistant for Tenant Rights & Lease Enforcement**

LeaseGuard is a real-time, AI-powered assistant that reads lease documents, flags illegal or unenforceable clauses, and gives tenants tailored advice based on local housing law. Powered by Redis 8 for lightning-fast vector search, document chunking, semantic caching, and event-driven alerts.

## 🎯 Problem & Solution

### The Problem
Renters often sign leases without fully understanding their rights or the enforceability of clauses. When disputes arise (e.g., eviction threats, repair neglect, illegal rent hikes), they are overwhelmed, under-informed, and unsupported in real time.

### The Solution
LeaseGuard provides:
- **Instant Lease Analysis**: Upload PDF or image documents for real-time clause extraction
- **Violation Detection**: AI-powered identification of illegal/unenforceable clauses using NYC housing law database
- **Contextual Q&A**: Ask follow-up questions with Redis-based memory and context retention
- **Legal Guidance**: Educational information about tenant rights with proper disclaimers

## 🚀 Features

### Core Features
- ✅ **Document Upload & Processing**: PDF and image (OCR) support
- ✅ **AI-Powered Clause Extraction**: Automatic identification of legal clauses
- ✅ **Violation Detection**: 20+ NYC housing law violation patterns
- ✅ **Real-Time Analysis**: <5 second processing time
- ✅ **Contextual Q&A**: Memory-enabled chat interface
- ✅ **Mobile-First Design**: Responsive UI optimized for mobile devices

### Redis 8 Showcase Features
- 🔍 **Vector Search**: Cosine similarity matching for clause comparison
- 📊 **RedisJSON**: Complex lease metadata storage
- 🌊 **Redis Streams**: Real-time document processing pipeline
- 🔄 **Hybrid Search**: Full-text + vector similarity search

### Security & Compliance
- 🛡️ **OWASP Top 10 Mitigation**: Comprehensive security measures
- 🔒 **Data Privacy**: 30-day retention policy, PII redaction
- ⚖️ **Legal Compliance**: Educational purposes only, proper disclaimers
- 🔐 **Secure Processing**: Client-side document parsing

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + LangChain
- **Database**: Redis Cloud (Vector, JSON, Streams) + Supabase
- **AI/ML**: Google Gemini Flash 1.5
- **Document Processing**: PDF.js + Tesseract.js (OCR)
- **Testing**: Jest + React Testing Library
- **Deployment**: Vercel + Railway

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Redis Cloud   │
│   (Next.js)     │◄──►│   (Express)     │◄──►│   (Vector DB)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PDF.js        │    │   Gemini AI     │    │   Supabase      │
│   Tesseract.js  │    │   (Embeddings)  │    │   (Analytics)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Redis Cloud account (free tier available)
- Google Gemini API key
- Supabase account (free tier available)

### 1. Clone the Repository
```bash
git clone https://github.com/Raj7122/LeaseGuard.git
cd LeaseGuard
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy the example environment file and configure your services:
```bash
cp env.example .env.local
```

Update `.env.local` with your credentials:
```env
# Redis Cloud Configuration
REDIS_URL=redis://username:password@your-redis-endpoint:port

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 4. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage
- Unit tests for core functionality
- Mocked external services (Redis, Gemini AI)
- Housing law database validation
- Component testing with React Testing Library

## 📊 NYC Housing Law Database

LeaseGuard includes a comprehensive database of 20 common illegal lease clause patterns:

### Critical Violations (5)
- Excessive Security Deposit (>1 month rent)
- Repair Responsibility Waiver
- Self-Help Eviction Authorization
- Right to Court Waiver
- Attorney Fee Shifting (One-Way)

### High Severity Violations (4)
- Illegal Rent Increase Provisions
- Discriminatory Provisions
- Illegal Entry Provisions
- Lease Renewal Denial Without Cause

### Medium/Low Violations (11)
- Excessive Late Fees
- Subletting Prohibition
- Guest Restrictions
- Pet Fees (Stabilized Units)
- Utility Responsibility Shift
- And more...

## 🎯 Usage Guide

### 1. Upload Your Lease
- Click "Upload Your Lease Document"
- Select PDF or image file (max 10MB)
- Wait for processing (typically <5 seconds)

### 2. Review Analysis
- View summary statistics
- Check flagged violations with severity levels
- Read legal references and explanations

### 3. Ask Questions
- Use the chat interface to ask follow-up questions
- Get personalized guidance about your specific clauses
- Receive actionable next steps

### 4. Take Action
- Contact legal aid organizations
- File complaints with NYC agencies
- Negotiate with landlords using legal knowledge

## 🔧 API Endpoints

### Document Upload
```http
POST /api/upload
Content-Type: multipart/form-data

file: [PDF or image file]
```

### AI Chat
```http
POST /api/chat
Content-Type: application/json

{
  "question": "What should I do about the security deposit?",
  "leaseId": "lease-uuid"
}
```

### Health Check
```http
GET /api/upload/health
```

## 🚀 Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Production
```env
REDIS_URL=your_production_redis_url
GEMINI_API_KEY=your_production_gemini_key
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NODE_ENV=production
```

## 📈 Performance Metrics

### Target Performance
- **Document Processing**: <5 seconds
- **AI Q&A Response**: <2.5 seconds
- **Redis Query Time**: <100ms
- **Vector Search**: <700ms
- **Uptime**: 99.9%

### Scalability
- **MVP Capacity**: 200 users/day
- **Hackathon Demo**: 10-15 concurrent sessions
- **Production Ready**: 10K monthly active users

## 🔒 Security Features

### OWASP Top 10 Mitigation
- ✅ **Injection Protection**: Parameterized queries, input validation
- ✅ **Broken Authentication**: Secure session management
- ✅ **Sensitive Data Exposure**: Encryption, PII redaction
- ✅ **XML External Entities**: Client-side PDF parsing
- ✅ **Broken Access Control**: Role-based routing
- ✅ **Security Misconfiguration**: Environment variables, security headers
- ✅ **Cross-Site Scripting**: Input sanitization, output encoding
- ✅ **Insecure Deserialization**: JSON only, no object serialization
- ✅ **Known Vulnerabilities**: Dependency scanning
- ✅ **Insufficient Logging**: Comprehensive audit trails

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Code Standards
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Jest for testing
- Conventional commits

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚖️ Legal Disclaimer

**Important**: LeaseGuard is for educational purposes only and does not constitute legal advice. The information provided is based on NYC housing laws but should not be relied upon for specific legal decisions. Always consult with a qualified attorney or legal aid organization for specific legal guidance.

## 🏆 Hackathon Project

This project was developed for the Redis Hackathon 2025, showcasing:
- Redis 8 Vector Search capabilities
- Real-time document processing
- AI-powered legal assistance
- Social impact through technology

## 📞 Support

For questions, issues, or contributions:
- GitHub Issues: [Create an issue](https://github.com/Raj7122/LeaseGuard/issues)
- Email: [Your email]
- Documentation: [Project Wiki](https://github.com/Raj7122/LeaseGuard/wiki)

---

**Built with ❤️ for NYC tenants and the Redis community**
