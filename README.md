# msgobs | Message Observers
A JavaScript modification for the Canvas learning management system. Adds the ability to message the observers of students on the Inbox and Gradebook pages.

## Description
Canvas has some excellent communications features, namely the ability to message students who have not submitted or scored above or below a particular grade in any assignment appearing in the marksbook by using the 'Message Students Who..' option. Unfortunately for K-12 institutions, there is no option to include observers (parents) in the recipients of such messages.

Fortunately, thanks to Canvas's open API, a workaround is possible. This script adds a couple of button on the Inbox and 'Message Students Who..' (Grades -> Assessment Header Dropdown -> 'Message Students Who...') pages to lookup the observers of specified students and insert them as recipients of the message.

![demo](https://cloud.githubusercontent.com/assets/22314386/18670963/c71ac7ac-7f74-11e6-87f4-1b24d749f7a1.gif)

Using the selections from the 'Message Students Who' criteria dropdown box you should be able to very quickly and efficiently:

* notify parents of students who have failed to submit assessments (Haven’t submitted option).
* notify parents of students who have failed to achieve required grades (Scored less than option).
* encourage parents of students who have achieved excellence (Scored more than.. option).
* explain why assessments haven’t been marked (Haven’t been marked option).

From the Inbox page you'll be able to
 * Easily send a message to the parents of a specific selection of students without having to find their email addresses manually through some other means.

## Usage
The script can be used either by adding the contents of msgobs.js to your institution's custom JavaScript file, or as a user script in a browser extension like GreaseMonkey (Firefox) or TamperMonkey (Chrome). Probably best to give is a try as a userscript first.

When being used as a userscript, you will need to update the @include URL to match your institution's Canvas instance.

Tested in Chrome, Safari, Firefox and Internet Explorer (Edge) only.

* Note: I have not had the opportunity to test the script with other institutions' Canvas instance. You may encounter issues, but I'm happy to offer advice: srice@scc.wa.edu.au *

## Known Issues
### Gradebook
I was unable to find where on the Gradebook page the names of students are matched with IDs of those students, so the script currently determines their ID based on the full name of the student. If two students with identical names are enrolled in the same course, the script will fail to distinguish between them and send messages to potentially incorrect recipients.

### HTML Integration
Because the script hooks into Canvas HTML elements in a number of locations it is vulnerable to changes in Canvas's element identifiers. The script is currently in use to good effect in our institution, so I expect to update the script whenever it breaks. You'll need to check back on this page to check for a new version in the event of a problem.
