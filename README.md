# msgobs | Message Observers
A JavaScript modification for the Canvas learning management system which adds the ability to message the observers of students on the Inbox and Gradebook pages.

## Donate
If you or your institution has found MSGOBS useful over the years and you'd like to make a small contribution to its upkeep, you may do so here: [Donate with Paypal](https://www.paypal.com/donate?business=WUJDYC8N3G63S&currency_code=AUD)

## Description
Canvas has some excellent communications features, namely the ability to message students who have not submitted or scored above or below a particular grade in any assignment appearing in the Gradesbook by using the 'Message Students Who..' option. Unfortunately for K-12 institutions, there is no option to include observers (parents) in the recipients of these messages.

Fortunately, thanks to Canvas's open API, a workaround is possible. This script enables teachers to add observers in the Canvas Inbox, and the Canvas Gradebook 'Message Students Who...' window, by adding a Add Observers button which will automatically insert matching observers into the recipient list of the message. 

![demo](https://cloud.githubusercontent.com/assets/22314386/18670963/c71ac7ac-7f74-11e6-87f4-1b24d749f7a1.gif)

## Changelog
Version 1.02 on 21/04/21
- Fixed issue with gradebook 'Scored less than' or 'Scored more than' options not showing any students.

Version 1.01 on 16/03/21
- Fixed Safari web browser issue
- Fixed course selector in no context id insertion issue.

Version 1.0 on 15/03/21
- Re-written for ES2020.
- Slight lookup speed improvement.
- Fixed issue where students on gradebook with the same name could not be distinguished between. 
- Fixed issue where that occurred when replying to a messages as a user with some admin privileges, but not all. In this scenario, MSGOBS now asks the user to select a course for observer lookup. 
- Fixed issue with colour highlighting of observers after the insert observers button was pressed for a second time. 
- Recipient groups are no longer expanded for a cleaner recipient list (unless removing students).
- Added warning message for replies in conversations that will create a group messages for all recipients. 
- Added Observer and Student removal counts to success messages. 
- Changed conversations behaviour as an admin sending a message. MSGOBS now asks the user to select a course for the observer lookup, rather than trying all enrolments for the user (which took a long time). 

Version 0.08 on 17/04/20
- Fixed conversations (Inbox) issue for instances with the faculty journal enabled.

Version 0.07 on 17/04/20
- Fixed issue where conversations (Inbox) recipients would become invalid after a recipient was removed. 

Version 0.06 on 11/10/17
- Added support for courses with more than one hundred enrolments.

Version 0.05 on 07/07/17
- Added auto tick "Send an individual message to each recipient" function. This behaviour is active by default, but can be disabled in the msgobs options.

Version 0.04 on 06/07/17
- Fixed issue where multiple course enrolment lookups were made for the same course in account admin mode.

Version 0.03 on 03/07/17
- Added support for any kind of group in the recipient list.

Version 0.02 on 15/03/17
- Fixed issue with unescaped message content.
- Prevented clicking Remove Students while Include observers function is running.
- Added dialog to preserve message content if sending fails in Gradebook function.  

Version 0.01
- Initial release.


## Usage
### Functions
Using the selections from the 'Message Students Who' criteria dropdown box you should be able to very quickly and efficiently:
* notify parents of students who have failed to submit assessments (Haven’t submitted option).
* notify parents of students who have failed to achieve required grades (Scored less than option).
* encourage parents of students who have achieved excellence (Scored more than.. option).
* explain to parents why assessments haven’t been marked (Haven’t been marked option).

From the Inbox page you'll be able to
 * Easily send a message to the parents of a selection of students.

### Requirements
* Observers will need to be enrolled in courses and linked to students, either manually or via SIS Import.

### Installation
The script can be used either by adding the contents of msgobs.user.js to your institution's custom JavaScript file, or as a userscript in a browser extension like TamperMonkey (Chrome & Firefox).

#### Custom JS Installation (for Canvas admins)
To use the script without having to use a browser extension you'll need to add the contents of msgobs.user.js to your Canvas custom JavaScript file. More about that here: https://community.canvaslms.com/docs/DOC-3010. This will make the script active for all teachers in your organisation and is the preferred method of installation. 


#### Browser Extention Instllation (for Canvas users)
  1. Using the Google Chrome web browser, download and install the extension [TamperMonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo).
  2. Click [here](https://github.com/sdjrice/msgobs/raw/master/msgobs.user.js) to install the msgobs as a userscript. Press 'Install' on the TamperMonkey window that appears.
  3. Hit TamperMonkey -> Dashboard -> Edit Icon on the right of the row for the MSGOBS script and update the @match line to include your institution's Canvas URL, followed by an asterisk. The final line should look something like this: **@match  https://canvas.instructure.com/* ** but with the url substituted with your own Canvas URL. 

*If you encounter issues, shoot me an email and we'll figure out why! sdjrice@gmail.com*

*It is recommended that you test the script on your Canvas test instance prior to putting it into wide use. After using the script to send to observers, check the Inbox -> Sent Items to see that everything worked!*

### Operation
#### Basic
* The script adds 'Include Observers' and 'Remove Students' buttons to both the Inbox
send message dialog (only if the user has at least one teacher enrolment) and the Gradebook 'Message Students Who...' pages.
* Clicking 'Include Observers' will add observers to the recipient list.
* Clicking 'Remove Students' will remove students from the recipient list.

#### Notes
* You cannot send messages to, nor perform lookups for, individuals to which the user would not normally have access. Using msgobs does not give greater access to individuals than they would normally have.
* When testing, be sure that the individuals to which you are sending test messages have confirmed their accounts (by clicking the email link). You cannot send messages to unverified users.

## Known Issues
### HTML Integration
Because the script hooks into Canvas HTML elements in a number of locations it is vulnerable to changes in Canvas's element identifiers. As we're currently using this script in our institution to good effect, I expect to update the script whenever it breaks. You'll need to check back on this page to check for a new version in the event of a problem.
