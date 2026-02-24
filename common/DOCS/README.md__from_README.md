# SPIS Family Module

A comprehensive Family Module for a national-scale Social Protection Information System (SPIS). This module handles family registration, member management, document verification, and integration with social protection programmes.

## 🏗️ Architecture

```
SPIS/
├── frontend/                    # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/ui/       # Reusable UI components
│   │   ├── layouts/             # Page layouts (Public, Citizen)
│   │   ├── pages/               # Page components
│   │   │   ├── public/          # Public pages (Home, Login, Notices)
│   │   │   ├── citizen/         # Authenticated citizen pages
│   │   │   └── registration/    # Registration wizard
│   │   ├── services/            # API service layer
│   │   ├── store/               # Zustand state management
│   │   ├── types/               # TypeScript type definitions
│   │   └── lib/                 # Utility functions
│   └── package.json
│
├── backend/
│   └── family-service/          # Express.js REST API
│       ├── src/
│       │   ├── routes/          # API route handlers
│       │   ├── middleware/      # Express middleware
│       │   ├── validators/      # Zod validation schemas
│       │   ├── types/           # TypeScript types
│       │   └── lib/             # Supabase client
│       └── package.json
│
└── family/
    ├── family-module-master.prompt.md  # Module specification
    └── references/                      # UI wireframe references
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Supabase account (for database)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Backend Setup

```bash
cd backend/family-service
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

npm run dev
```

The API will be available at `http://localhost:3001`

## 📚 Features

### Public Website
- **Home Page**: Landing page with service information and CTAs
- **Public Notices**: View government notices and announcements
- **Login**: Citizen authentication

### Citizen Dashboard
- **Dashboard**: Overview with registration status, programme summary, notifications
- **My Family**: View family details, members, and address
- **My Profile**: Personal information and account settings
- **Documents**: Upload and manage verification documents
- **Benefits**: View received benefits and payment history
- **Programmes**: Browse eligible programmes, view enrollment status
- **Grievances**: Submit complaints and track resolution
- **Settings**: Account preferences

### Registration Flow
- Multi-step wizard for family registration
- Capture head of family details
- Add household members
- Enter address information
- Upload supporting documents
- Review and submit for verification

## 🔌 API Endpoints

### Families
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/families` | List all families (paginated) |
| GET | `/api/v1/families/:id` | Get family with full details |
| POST | `/api/v1/families` | Create new family |
| PATCH | `/api/v1/families/:id` | Update family |
| POST | `/api/v1/families/:id/submit` | Submit for verification |
| GET | `/api/v1/families/:id/history` | Get audit history |

### Members
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/members/family/:familyId` | List family members |
| GET | `/api/v1/members/:id` | Get member details |
| POST | `/api/v1/members` | Add new member |
| PATCH | `/api/v1/members/:id` | Update member |
| DELETE | `/api/v1/members/:id` | Remove member (soft delete) |

### Addresses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/addresses/family/:familyId` | Get family address |
| GET | `/api/v1/addresses/:id` | Get address by ID |
| POST | `/api/v1/addresses` | Create address |
| PATCH | `/api/v1/addresses/:id` | Update address |
| POST | `/api/v1/addresses/:id/verify` | Verify address (admin) |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/documents/family/:familyId` | List family documents |
| GET | `/api/v1/documents/member/:memberId` | List member documents |
| GET | `/api/v1/documents/:id` | Get document by ID |
| POST | `/api/v1/documents` | Upload document metadata |
| POST | `/api/v1/documents/:id/verify` | Verify document (admin) |
| DELETE | `/api/v1/documents/:id` | Delete document |

## 🗄️ Database Schema

The module uses Supabase PostgreSQL with the `family` schema. Key tables:

- `families` - Core family records with registration status
- `family_members` - Individual members linked to families
- `addresses` - Family residential addresses
- `documents` - Uploaded documents (metadata)
- `document_verifications` - Document verification status
- `biometric_metadata` - Biometric enrollment references
- `account_details` - Bank account information
- `identity_matches` - External ID system matches
- `family_history` - Audit trail of all changes
- `family_event_outbox` - Event publishing for async processing

## 🎨 Design System

- **Primary Color**: `#0f2cbd`
- **Font**: Public Sans (Google Fonts)
- **Icons**: Material Symbols Outlined
- **Framework**: Tailwind CSS with dark mode support

## 🔐 Security Considerations

- Row Level Security (RLS) policies on all tables
- JWT-based authentication
- Input validation with Zod
- CORS configuration
- Helmet security headers
- Audit logging of all changes

## 📦 Tech Stack

### Frontend
- React 18
- TypeScript 5
- Vite 5
- Tailwind CSS 3.4
- Zustand 4 (state management)
- React Router DOM 6
- Axios

### Backend
- Node.js 18+
- Express.js 4
- TypeScript 5
- Supabase JS Client
- Zod (validation)
- UUID

## 🔜 Future Enhancements

- [ ] Biometric enrollment integration
- [ ] SMS/email notifications
- [ ] Document OCR verification
- [ ] Real-time updates with WebSockets
- [ ] Admin dashboard
- [ ] Multi-language support
- [ ] Offline-first mobile app

## 📄 License

This project is part of the Social Protection Information System (SPIS) initiative.
