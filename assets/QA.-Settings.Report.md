#  QA Test Report: Settings  (Task-4)

**Date:** [Mar/08/2026]  
**Tester:** Bashar Nasser   
**Status:**  Completed

---

##  Acceptance Criteria Checklist
- All profile fields load, update, and persist correctly
- HR self-service links appear only for users with Fusion HR access
- Navigation from HR links reaches correct destination
- All edge cases and failures documented with evidence

---

##  Test Environment
- **Base URL:** https://erpstaging.ivs.global/
- **Browser:** Edge , Chrome
- **Test Accounts:** Admin, Standard User


---

##  Test Cases & Results

### 1️⃣ Profile Data Loading
| ID | Field | Expected Value | Actual Value | Status |
|----|-------|----------------|--------------|--------|
| L-01 | Display Name |User's Name  | All fields populated correctly | 🟢Pass |
| L-02 | Avatar URL | Valid Image   | All fields populated correctly| 🟢Pass |
| L-03 | Timezone | User's Timezone | All fields populated correctly |🟢Pass |


### 2️⃣ Profile Update & Persistence
| ID | Action | Steps | Expected Result | Actual Result | Status |
|----|--------|-------|-----------------|---------------|--------|
| U-01 | Update Name | 1. Change Display Name<br>2. Click Save<br>3. Refresh Page | New name persists | NO change occurs - Same as BUG-01 | 🔴Fail |
| U-02 | Avatar URL |  1. Enter new Image URL<br>2. Click Save<br>3. Refresh Page& Logout & Login | New avatar image displays correctly | NO change occurs - Same as BUG-01 | 🔴Fail |
| U-03 | Update Timezone | 1. Change Timezone<br>2. Click Save<br>3. Refresh Page& Logout & Login | New timezone persists | NO change occurs - Same as BUG-01 | 🔴Fail |


### 3️⃣ HR Self-Service Links
| ID | User Type | Expected Visibility | Actual Visibility | Status |
|----|-----------|---------------------|-------------------|--------|
| H-01 | Admin | Links Visible | HR Links section visible | 🟢Pass |
| H-02 | Standard User | Links Visible | HR Links section visible | 🟢Pass |


### 4️⃣ HR Link Navigation
| ID | Link Name | Expected Destination | Actual Destination | Status |
|----|-----------|---------------------|-------------------|--------|
| N-01 | My Employee Profile,My Attendance | /hr/leave | Navigated to /hr/leave| 🟢Pass |

---

##  Bug Reports
## BUG-01: Settings Changes Not Persisting & UX Improvements

| Field | Details |
|-------|---------|
| **ID** | BUG-01 |
| **Title** | [Functionality] Profile changes (Avatar/Timezone) do not save successfully |
| **Severity** | 🟡 **MEDIUM** |
| **Priority** | 🟡 **MEDIUM** |
| **Module** | Settings / Profile  |

###  Description
When updating profile settings (Avatar, Timezone, Display Name), the form accepts input but changes are not saved to the database upon refresh. Additionally, UX improvements are suggested for better usability.

### Steps to Reproduce
1. Login as Standard User.
2. Navigate to `/settings`.
3. Update **Display Name** or **Timezone**.
4. For Avatar: Enter a URL (or attempt to upload if available).
5. Click **Save**.
6. Refresh the page or Logout and Login again.

###  Expected Result
- Changes should be saved and persist after refresh.
- Avatar should be updated successfully.
- Timezone should be selected from a predefined list (to avoid typos).



###  Recommendations (UX)
1. Replace Avatar URL input with **Photo Upload** button.
2. Replace Timezone text input with **Dropdown Selection**.

---



**END OF DOCUMENT**