# Branch360 iOS App - Future Implementation

This directory contains the placeholder structure for the future iOS native app.

## Structure

```
/ios-app-future/
├── Branch360/
│   ├── Views/
│   │   ├── LoginView.swift [TODO]
│   │   ├── DashboardView.swift [TODO]
│   │   ├── LeadSubmissionView.swift [TODO]
│   ├── Models/
│   │   ├── Lead.swift [TODO]
│   │   ├── User.swift [TODO]
│   ├── Services/
│   │   ├── APIClient.swift [TODO]
│   └── Branch360App.swift [TODO]
```

## Technology Stack (Planned)

- **Language**: Swift 5.9+
- **UI Framework**: SwiftUI
- **Architecture**: MVVM
- **Networking**: URLSession with async/await
- **Local Storage**: Core Data or SwiftData
- **Dependency Injection**: Swinject
- **Minimum iOS Version**: iOS 16.0+

## Implementation Phases

1. **Phase 1**: Core infrastructure (API client, models, authentication)
2. **Phase 2**: Role-based dashboards (AE, Tech, Ops Manager)
3. **Phase 3**: Feature modules (lead submission, pipeline management)
4. **Phase 4**: Offline support and sync
5. **Phase 5**: Push notifications and real-time updates

## Data Models

All models should match the schema defined in `/src/config.gs`:
- Lead model matches `LEADS` sheet schema
- User model matches `USERS` sheet schema
- Additional models for Tracker, Accounts, Quotes, etc.

## API Integration

The app will integrate with Google Apps Script Web Apps:
- Authentication via Google OAuth 2.0
- RESTful API calls to script endpoints
- JSON request/response format
- Error handling and retry logic

## See Also

- [Mobile App Roadmap](../MOBILE_APP_ROADMAP.md) - Complete development roadmap
- [Android App Structure](../android-app-future/README.md) - Android implementation plan
- [Current PWA Implementation](../src/) - Web app source code

