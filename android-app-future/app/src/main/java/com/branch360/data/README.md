# Data Package - TODO

This package will contain data layer components:

- **models/** - Data models matching config.gs schema
  - Lead.kt
  - User.kt
  - TrackerEntry.kt
  - Account.kt
  - etc.

- **repository/** - Data repositories
  - LeadRepository.kt
  - UserRepository.kt
  - TrackerRepository.kt

- **api/** - API client
  - Branch360Api.kt - Google Apps Script API integration
  - ApiClient.kt - HTTP client setup

- **database/** - Local database (Room)
  - Branch360Database.kt
  - DAOs for offline support

