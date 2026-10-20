# DayFlow

DayFlow is a lightweight personal productivity web app designed to help individuals and families organize everyday activities in one place.

## Features

- **Dashboard:** View an overview of your tasks and daily activity.
- **Tasks:** Create, edit, complete, and delete tasks.
- **Calendar:** View tasks by date and navigate between months.
- **Shopping Lists:** Create shopping lists, manage items and quantities, and mark items as purchased.
- **Settings:** Customize the workspace name, switch between light and dark themes, and manage local data.
- **Backup and Restore:** Export and restore data, including full backups and supported selective restores.

## Live Demo: 
[Open DayFlow](https://kapilbasu9.github.io/DayFlow/)

## Feedback and Support

DayFlow is evolving, and feedback from early users is welcome.

- **[Report a bug or request a feature](https://github.com/kapilbasu9/DayFlow/issues/new)** — Submit a new issue with your feedback.
- **[Browse existing issues](https://github.com/kapilbasu9/DayFlow/issues)** — Check existing reports and discussions.
- **[Feedback guide](https://github.com/kapilbasu9/DayFlow/issues/1)** — Read the welcome message and guidance for sharing feedback.

When reporting a bug, describe the steps to reproduce it and what you expected to happen. Please don't post passwords, personal information, or private backup files in public issues.

## Project Repository: 
[GitHub — DayFlow](https://github.com/kapilbasu9/DayFlow)

## Technology

- HTML5
- CSS3
- Vanilla JavaScript using ES modules
- Browser `localStorage` for data persistence

DayFlow currently runs without a backend, account system, cloud synchronization, or payment integration.

## Run Locally

1. Download or clone this repository.
2. Open the project folder in Visual Studio Code.
3. Install or enable the Live Server extension if needed.
4. Open `index.html` with Live Server.
5. Navigate through the Dashboard, Tasks, Calendar, Shopping, and Settings pages.

Opening the project through a local web server is recommended because the application uses JavaScript ES modules.

## Data and Privacy

DayFlow stores application data in the browser's local storage. This means data is specific to the browser and origin being used; it does not automatically synchronize between devices or browsers.

Export backups regularly if you want an additional copy of your data. Treat exported backup files as private because they may contain your tasks, shopping lists, and preferences.

Clearing browser storage or using the application's data-clearing function can remove locally stored information. Keep a backup before clearing data you want to retain.

## Project Structure

```text
DayFlow/
├── index.html
├── pages/
│   ├── dashboard.html
│   ├── tasks.html
│   ├── calendar.html
│   ├── shopping.html
│   └── settings.html
├── css/
│   ├── global.css
│   ├── variables.css
│   ├── layout.css
│   ├── components.css
│   └── pages/
├── js/
│   ├── app.js
│   ├── appPreferences.js
│   ├── modules/
│   ├── services/
│   ├── components/
│   └── utils/
├── docs/
└── tests/
```

## Documentation

Project architecture and data-model notes are available in the `docs/` directory.

## Testing Status

The application has undergone manual checks covering navigation, task and shopping-list operations, preferences, calendar behavior, backup and restore, responsive layouts, and cross-tab behavior.

The repository does not currently include an automated test suite. Manual verification does not guarantee that every possible scenario has been tested.

## Current Status

DayFlow is an evolving project. Features, documentation, and architecture may change as development continues.
