# Branch360 - Operations Manager User Guide

## Table of Contents
1. [Logging In](#logging-in)
2. [Viewing Your Dashboard](#viewing-your-dashboard)
3. [Monitoring Team Metrics](#monitoring-team-metrics)
4. [Assigning Specialists](#assigning-specialists)
5. [Resolving Issues](#resolving-issues)
6. [Logging Daily Metrics](#logging-daily-metrics)
7. [Best Practices](#best-practices)

---

## Logging In

1. Open the Branch360 Google Sheets application
2. Your account is automatically authenticated using your Google account email
3. The system will recognize your role as Operations Manager
4. You'll be taken directly to your Operations Manager Dashboard

**Note:** If you don't see your dashboard, contact your administrator to ensure your account is set up correctly.

---

## Viewing Your Dashboard

Your Operations Manager Dashboard provides comprehensive oversight of your branch's operations:

### Today's Metrics
Real-time operational metrics for today:
- **Missed Stops (TMX)**: Total missed stops - TMX category
- **Missed Stops (RNA)**: Total missed stops - RNA category
- **Backlog Percent**: Average backlog percentage across team
- **OT Percent**: Average overtime percentage
- **Forecasted Hours**: Total forecasted hours for the day

### Team Technicians
Overview of all technicians in your branch:
- **Name and Email**: Contact information
- **Active Status**: Whether technician is currently active
- **Performance Metrics**: Leads submitted, installations completed

### Pending Installations
All installations that need to be scheduled or assigned:
- **Customer Name**: Account name
- **Service Address**: Installation location
- **Sold Date**: When the sale was closed
- **Assigned Specialist**: Currently assigned technician (if any)
- **Scheduled Date**: Installation date (if scheduled)

### Open Issues
Service issues requiring attention:
- **Issue ID**: Unique identifier
- **Date**: When issue was reported
- **Customer**: Customer name
- **Issue Type**: Type of problem
- **Severity**: High, Medium, or Low (sorted by severity)
- **Status**: Open or In Progress
- **Assigned Tech**: Technician handling the issue
- **Description**: Details about the issue

### Weekly Metrics
Week-to-date operational performance:
- **Total Missed Stops**: Combined TMX and RNA
- **Average Backlog**: Average backlog percentage for the week
- **Average OT**: Average overtime percentage
- **Total Coaching Rides**: Number of coaching rides completed
- **Days Reported**: Number of days with metrics logged

---

## Monitoring Team Metrics

### Viewing Individual Technician Performance
1. Navigate to "Team Technicians" section
2. View each technician's:
   - Leads submitted count
   - Installations completed count
   - Active status

### Daily Metrics Overview
Monitor your branch's daily operational health:
- **Missed Stops**: Track both TMX and RNA categories
- **Backlog**: Monitor backlog percentage trends
- **Overtime**: Track OT percentage to manage labor costs
- **Forecasted Hours**: Compare forecasted vs. actual hours

### Weekly Trends
Review weekly metrics to identify:
- Patterns in missed stops
- Backlog trends
- Overtime patterns
- Coaching effectiveness

### Best Practices for Monitoring
- Review metrics daily
- Identify trends early
- Address issues before they escalate
- Use metrics for coaching conversations

---

## Assigning Specialists

When a sale is closed, you need to assign a specialist to complete the installation.

### Viewing Pending Installations
1. Check the "Pending Installations" section
2. Installations show:
   - Customer name and address
   - Date the sale was closed
   - Current assignment status
   - Scheduled date (if scheduled)

### Assigning a Specialist

1. Select an installation from "Pending Installations"
2. Click "Assign Specialist"
3. Select a technician from your team
4. Optionally set a scheduled date
5. Click "Assign"

The system will:
- Update the installation record
- Notify the assigned technician
- Create a notification for the tech
- Log the assignment in audit log

### Assignment Best Practices
- Assign based on:
  - Technician workload
  - Geographic proximity
  - Technician expertise
  - Customer preferences (if any)
- Schedule installations promptly after sale
- Balance workload across team
- Consider technician availability

### Scheduling Installations
When assigning, you can:
- Set a specific installation date
- Leave date open for technician to schedule
- Coordinate with customer availability
- Ensure materials are ordered before scheduling

---

## Resolving Issues

### Viewing Open Issues
Issues are automatically sorted by:
1. **Severity**: High priority issues first
2. **Date**: Most recent issues first

### Issue Details
Each issue shows:
- Customer information
- Issue type and description
- Severity level
- Current status
- Assigned technician
- Date reported

### Resolving an Issue

1. Select an issue from "Open Issues"
2. Review the issue details and any notes
3. Take appropriate action:
   - Assign to a technician if not already assigned
   - Escalate if needed
   - Contact customer if necessary
4. Click "Resolve Issue"
5. Enter resolution notes:
   - What was done to resolve
   - Root cause (if identified)
   - Preventive measures taken
   - Customer response
6. Click "Mark Resolved"

### Issue Resolution Best Practices
- **Respond Quickly**: Address high-severity issues immediately
- **Assign Appropriately**: Match issue to technician expertise
- **Document Thoroughly**: Include all relevant details in resolution notes
- **Follow Up**: Verify resolution with customer when appropriate
- **Learn from Issues**: Use issues to identify process improvements

### Escalating Issues
If an issue requires:
- Higher-level management attention
- Additional resources
- Customer service intervention
- Special handling

Mark it as "Escalated" and notify your Branch Manager.

---

## Logging Daily Metrics

At the end of each day, log your branch's operational metrics.

### When to Log
- End of each business day
- Before leaving for the day
- Ensures accurate reporting

### Daily Metrics to Log

1. Navigate to "Log Daily Metrics"
2. Enter the following:
   - **Missed Stops (TMX)**: Count of TMX missed stops
   - **Missed Stops (RNA)**: Count of RNA missed stops
   - **Backlog Percent**: Average backlog percentage
   - **OT Percent**: Average overtime percentage
   - **Forecasted Hours**: Total forecasted hours
   - **Request Review Goal**: Target for request reviews
   - **Request Review Actual**: Actual request reviews completed
   - **Coaching Rides**: Number of coaching rides conducted
   - **TAP from Coaching**: Talk-to-appointments generated from coaching

3. Click "Save Metrics"
4. The system will:
   - Create or update today's metrics entry
   - Aggregate data for reporting
   - Update dashboard displays

### Metrics Accuracy
- Use actual numbers, not estimates
- Verify data before submitting
- Be consistent with measurement methods
- Review previous entries for context

---

## Best Practices

### Daily Routine
1. **Morning**: Review dashboard, check overnight issues, plan day
2. **Throughout Day**: Monitor metrics, assign installations, resolve issues
3. **End of Day**: Log daily metrics, review team performance

### Team Management
- Monitor technician workload daily
- Balance assignments fairly
- Provide timely feedback
- Recognize good performance

### Issue Management
- Address high-severity issues immediately
- Track issue resolution times
- Identify recurring issues
- Implement preventive measures

### Metrics Management
- Log metrics consistently
- Review trends regularly
- Use metrics for coaching
- Share insights with Branch Manager

### Installation Management
- Assign installations promptly
- Ensure materials are ordered
- Verify scheduling with customers
- Follow up on completions

### Communication
- Keep Branch Manager informed
- Communicate with technicians regularly
- Update customers on issues
- Document all actions

---

## Getting Help

If you need assistance:
1. Check this guide first
2. Contact your Branch Manager
3. Reach out to system administrator for technical issues
4. Review API documentation for system details

---

**Last Updated:** 2024
**Version:** 1.0

