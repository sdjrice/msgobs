// ==UserScript==
// @name        MSGOBS: Message Observers in Canvas
// @namespace   msgobs
// @match     https://canvas.test.instructure.com/*
// @match     https://canvas.instructure.com/*
// @version     v1.0
// @grant       none
// ==/UserScript==

// If you are using TamperMonkey / GreaseMonkey you will need to update the above URLs
//  to your own canvas instance. Don't forget the * after the trailing slash to ensure the script runs on all pages
//  Alternativley you can specify which pages this script should run on from the GreaseMonkey
//  control panel.

// The above UserScript block may be removed entirely if you are not using GreaseMonkey or TamperMonkey etc, and are
// instead applying the script to your entire site.

/*
 * MSGOBS v1.0
 * https://github.com/sdjrice/msgobs
 * Stephen Rice
 * sdjrice@gmail.com
 */
{
  const options = new Map([
    ['autoCheckBulkMsgBox', true], //Checks the 'send individual messages' checkbox on new messages in conversations. 
    ['observerColour', 'bisque'],
    ['buttonWidth', '110px'],
    ['autoTickIndividualMsgCheckbox', true],
    ['instanceUrl', ''], // for testing
    ['browser', true], // for testing
    ['useToken', false], // for testing
    ['token', ''], // never insert an API token.
  ]);

  const messages = new Map([
    ['btnAddObservers', 'Include Observers'],
    ['btnRemoveStudents', 'Remove Students'],
    ['busy', 'Working...'],
    ['noStudents', 'There are no students in the recipient list.'],
    ['observersAdded', 'observers added.'], //preceeded by observer count.
    ['noObservers', 'No observers found.'],
    ['studentsRemoved', 'students removed.'], //preceeded by student count.
    ['noRecipients', 'There are no recipients in the recipient list.'],
    ['groupExpansion', 'Your recipient list contains groups. Groups will be expanded into their respective members.'],
    ['noContext', 'No course context was detected. Please select a course to be used for observer lookups or enter the Course ID manually, then try again.'],
    ['replyMessageToObservers', `You're adding observers to a reply message. Reply messages create group conversations with all recipients included. Recipients will see each other's replies.`]
  ]);

  const elements = new Map([
    ['convosWindowClass', 'div.compose-message-dialog'],
    ['convosBtnContainer', '.attachments'],
    ['convosRecipientElem', '.ac-token'],
    ['convosComposeBtn', '#compose-btn'],
    ['convosBulkMsg', '#bulk_message'],
    ['gradesWindowClass', '#message_students_dialog'],
    ['gradesBtnContainer', '.button-container'],
    ['gradesRecipientElem', '.student:not(.blank)'],
    ['gradesMessageTypesElem', '#message_assignment_recipients .message_types'],
    ['flashMessageElem', '#flash_message_holder']
  ]);

  const msgobs = {};

  function init() {
    //Activates msgobs on conversations and gradebook pages
    if (options.get('browser')) {
      const location = new String(window.location.href);
      let mode = false;
      // Canvas ENV object contains role information
      let role = window.ENV?.current_user_roles.includes('teacher') || window.ENV?.current_user_roles.includes('admin');

      if (location.includes('/conversations')) { mode = 'conversations'; };
      if (location.includes('/gradebook')) { mode = 'gradebook'; };

      if (mode && role) {
        console.log('--- \n MSGOBS v1.0  \n https://github.com/sdjrice/msgobs \n sdjrice@gmail.com \n ---');
        msgobs.ui = new Ui(mode);
      }
    }
  }

  class PeopleCollection {
    constructor() {
      this.recipients = [];
      this.contextEnrolments = [];
      this.newRecipients = [];
    }
  }

  class Ui {
    constructor(mode) {
      // Create buttons
      this.buttons = {
        addObservers: this.newButton(messages.get('btnAddObservers'), mode),
        removeStudents: this.newButton(messages.get('btnRemoveStudents'), mode)
      };

      // Button Events
      this.buttons.addObservers.addEventListener('click', event => {
        this.insertObservers(mode);
      });

      this.buttons.removeStudents.addEventListener('click', event => {
        this.removeStudents(mode);
      });

      // Insert UI
      this.insert(mode, this.buttons);
    }

    newButton(txt, mode) {
      // Create a button element with Canvas styles
      let button = document.createElement('div');
      button.appendChild(document.createTextNode(txt));
      button.classList.add('ui-button', 'ui-widget', 'ui-state-default', 'ui-corner-all', 'ui-button-text-only');
      button.style.margin = '0 2px';
      if (mode === 'gradebook') button.style.float = 'left';
      return button;
    }

    async insert(mode, buttons) {
      // Insert buttons into the message students dialogue window
      if (mode === 'conversations') {
        this.buttons.courseSelection = await this.courseSelectionInputUi();
      }

      setTimeout(() => {
        // timeout loop to detect when the message dialog window exists. 
        if (document.querySelector(getMsgWindowElementName(mode))) {
          this.dialog = document.querySelector(getMsgWindowElementName(mode));
          for (const button of Object.values(buttons)) {
            document.querySelector(getMsgWindowElementBtnsName(mode)).appendChild(button);
          }

          if (mode === 'conversations' && options.get('autoCheckBulkMsgBox')) {
            if (document.querySelector(elements.get('convosBulkMsg'))) {
              document.querySelector(elements.get('convosBulkMsg')).checked = true;
            }
          }

          if (mode === 'gradebook') {
            // Add eventlistener to remove recipient elemnents added by msgobs when type changes
            document.querySelector(elements.get('gradesMessageTypesElem')).addEventListener('change', () => {
              const recipientElements = document.querySelectorAll(elements.get('gradesRecipientElem'));
              for (const element of recipientElements) {
                element.remove();
              }
            });
          }
        } else {
          this.insert(mode, buttons);
        }
      }, 1000);
    }

    insertObservers(mode) {
      // insert observers button action
      insertObservers(mode);
    }

    removeStudents(mode) {
      // Revove students button action
      removeStudents(mode);
    }

    busy(button) {
      // Set buttons to disabled while busy
      this.buttons.addObservers.setAttribute('disabled', '');
      this.buttons.removeStudents.setAttribute('disabled', '');
      button.innerText = messages.get('busy');
    }

    ready() {
      // Ready buttons after lookup is complete.
      this.buttons.addObservers.removeAttribute('disabled');
      this.buttons.addObservers.innerText = messages.get('btnAddObservers');
      this.buttons.removeStudents.removeAttribute('disabled');
      this.buttons.removeStudents.innerText = messages.get('btnRemoveStudents');
    }

    async courseSelectionInputUi() {
      // Returns course id selection ui for when a course id cannot be found.
      const enrolments = await getCurrentUserEnrolments();
      let courses = [];
      for (const enrolment of enrolments) {
        if (enrolment.role === 'TeacherEnrollment') {
          courses.push(...await getCourse(enrolment.course_id));
        }
      }

      // Create html elements
      let selectionContainer = document.createElement('div');
      let select = document.createElement('select');
      let input = document.createElement('input');
      selectionContainer.style = 'margin: .5em 0; display: none;';
      selectionContainer.innerHTML = `${messages.get('noContext')}<br />`;
      input.setAttribute('type', 'text');
      input.setAttribute('placeholder', 'Course ID');
      input.style = "width: 5em";

      let defaultTxt = document.createElement('option');
      defaultTxt.appendChild(document.createTextNode('Select a course...'));
      select.appendChild(defaultTxt);

      // Insert list of courses
      for (const course of courses) {
        if (course.workflow_state === 'available') {
          let option = document.createElement('option');
          option.value = course.id;
          if (course.sis_course_id) option.appendChild(document.createTextNode(`${course.sis_course_id} `));
          if (course.name) option.appendChild(document.createTextNode(course.name));
          select.appendChild(option);
        }
      }

      selectionContainer.appendChild(select);
      selectionContainer.appendChild(input);

      // Add events
      select.addEventListener('click', () => {
        if (/^[0-9]*$/.test(select.value)) { input.value = select.value; } else { input.value = ''; };
      });

      document.querySelector(elements.get('convosComposeBtn')).addEventListener('click', () => {
        selectionContainer.style.display = 'none';
        input.value = '';
      });

      return selectionContainer;
    }
  }

  async function insertObservers(mode) {
    // Lookup and insert observers into recipient field.
    const recipients = getPageRecipients(mode);
    const context = getPageCourseContext(mode);
    let observers = 0;

    if (!recipients || !recipients.length) { // Check there are recipients
      doCanvasUiMessage(messages.get('noRecipients'), 'warning', 6000);
      return false;
    }

    if (!context) { // Check there is a course context set. 
      return false;
    }

    msgobs.ui.busy(msgobs.ui.buttons.addObservers);
    let people = new PeopleCollection();
    people.recipients = await getPeople(recipients, context);
    people.recipients = deDupePeople(people.recipients);
    people.contextEnrolments = await getCourseEnrolments([getPageCourseContext(mode)]);
    associateEnrolmentData(people.recipients, people.contextEnrolments);

    // insert observers into page
    for (const recipient of people.recipients) {
      if (recipient.msgobs.observers.length > 0) { // check there are observers
        for (const observer of recipient.msgobs.observers) {
          if (!people.recipients.find(recipient => recipient.id == observer.id)) { // check observers aren't already recipients
            setPageRecipient(mode, observer);
            observers++;
          }
        }
      }
      setPageUiDetails(mode, recipient); // add colours and title attributes to recipients
    }

    if (observers) {
      doCanvasUiMessage(`${observers} ${messages.get('observersAdded')}`, 'success', 6000);
    } else {
      doCanvasUiMessage(messages.get('noObservers'), 'warning', 6000);
    }

    msgobs.ui.ready();
  }

  async function removeStudents(mode) {
    // Remove students from recipient list
    const recipients = getPageRecipients(mode);
    const context = getPageCourseContext(mode);
    let deletions = 0;

    if (!recipients.length) { // check for recipients
      doCanvasUiMessage(messages.get('noRecipients'), 'warning', 6000);
      return false;
    }

    if (!context) { // check for course context
      return false;
    }

    msgobs.ui.busy(msgobs.ui.buttons.removeStudents);
    let people = new PeopleCollection();
    people.recipients = await getPeople(recipients, context);
    people.recipients = deDupePeople(people.recipients);
    people.contextEnrolments = await getCourseEnrolments([getPageCourseContext(mode)]);
    associateEnrolmentData(people.recipients, people.contextEnrolments);

    if (mode === 'conversations') {
      clearPageRecipients(mode);
      for (const person of people.recipients) {
        setPageRecipient(mode, person);
        setPageUiDetails(mode, person);
      }

    }

    for (const person of people.recipients) {
      if (person.msgobs.role === 'StudentEnrollment') {
        deletePageRecipient(mode, person);
        deletions++;
      }
    }

    if (deletions) {
      doCanvasUiMessage(`${deletions} ${messages.get('studentsRemoved')}`, 'success', 6000);
    } else {
      doCanvasUiMessage(messages.get('noStudents'), 'warning', 6000);
    }

    msgobs.ui.ready();

  }

  function getMsgWindowElementName(mode) {
    // returns selector for message dialogue box element
    switch (mode) {
      case 'conversations':
        return elements.get('convosWindowClass');
      case 'gradebook':
        return elements.get('gradesWindowClass');
    }
  }

  function getPageCourseContext(mode) {
    // returns the course id context for the current page
    switch (mode) {
      case 'conversations':
        const canvasCourseContext = conversationsRouter?.compose?.recipientView?.currentContext?.id ?? false;
        const manualEntryValue = msgobs.ui.buttons.courseSelection.querySelector('input').value;
        if (/^course_[0-9]*$/.test(canvasCourseContext)) {
          msgobs.ui.buttons.courseSelection.style.display = 'none';
          return conversationsRouter.compose.recipientView.currentContext.id;
        } else if (/^[0-9]+$/.test(manualEntryValue)) {
          return manualEntryValue;
        } else {
          msgobs.ui.buttons.courseSelection.style.display = 'block';
          return false;
        }
      case 'gradebook':
        return ENV.context_asset_string;
    }
  }

  function getMsgWindowElementBtnsName(mode) {
    // returns the selector for the button container
    switch (mode) {
      case 'conversations':
        return elements.get('convosBtnContainer');
      case 'gradebook':
        return elements.get('gradesBtnContainer');
    }
  }

  function getPageRecipients(mode) {
    // returns recipients selected on page
    let recipients = [];
    switch (mode) {
      case 'conversations':
        // Conversations recipients are stored in the conversationsRouter object.
        if (conversationsRouter?.compose?.to?.includes('reply')) {
          doCanvasUiMessage(messages.get('replyMessageToObservers'), 'warning', 20000);
        }
        return conversationsRouter.compose.recipientView.tokens;
      case 'gradebook':
        // Gradebook recipients are attached using jQuery's abitrary data function.
        $('#message_assignment_recipients').find('.student:visible').each(function () {
          recipients.push($(this).data('id'));
        });
        return recipients;
    }
  }

  function setPageRecipient(mode, recipient) {
    // Set recipient on page
    switch (mode) {
      case 'conversations':
        if (typeof recipient.id !== String) recipient.id = String(recipient.id);
        window.conversationsRouter.compose.recipientView.setTokens([recipient]);
        break;
      case 'gradebook':
        let element = $('#message_students_dialog ul li.blank:first')
          .clone(false)
          .removeClass('blank')
          .data('id', recipient.id)
          .css('display', 'list-item');
        $('.name', element).text(recipient.name);
        element.find('button').remove();

        let removeButton = $('<div class="remove-button Button Button--icon-action"><i class="icon-x"></i></div>');
        removeButton.on('click', function () { $(this).parent().remove(); });
        element.append(removeButton);

        $('#message_assignment_recipients .student_list').append(element);
        break;
    }
  }

  function deletePageRecipient(mode, recipient) {
    // Remove recipient from page
    switch (mode) {
      case 'conversations':
        conversationsRouter.compose.recipientView._removeToken(recipient.id);
        break;
      case 'gradebook':
        const gradeTokens = document.querySelectorAll(`${elements.get('gradesWindowClass')} ${elements.get('gradesRecipientElem')}`);
        for (const token of gradeTokens) {
          const tokenId = $(token).data('id');
          if (tokenId == recipient.id) {
            token.remove();
          }
        }
        break;
    }
  }

  function clearPageRecipients(mode) {
    switch (mode) {
      case 'conversations':
        const tokens = [...getPageRecipients(mode)];
        if (tokens) {
          for (let token of tokens) {
            conversationsRouter.compose.recipientView._removeToken(token);
          }
        }
        break;
    }
  }

  function setPageUiDetails(mode, recipient) {
    // add ui colour and alt text details to recipients
    switch (mode) {
      case 'conversations':
        const convoTokens = document.querySelectorAll(`${elements.get('convosWindowClass')} ${elements.get('convosRecipientElem')}`);
        for (const token of convoTokens) {
          const id = token.querySelector('input');
          if (id.defaultValue == recipient.id) {

            // set observed user text.
            if (recipient.msgobs.observers) {
              for (const observer of recipient.msgobs.observers) {
                let txt = `Observed by: ${recipient.name}`;
                if (token.getAttribute('title')) { txt = `${token.getAttribute('title')}, + ${txt};`; }
                token.setAttribute('title', txt);
              }
            }

            // set observer style and text where user has an observer
            if (recipient.msgobs.observing.length) {
              token.style = `background-color: ${options.get('observerColour')}; border-color: rgba(0,0,0,0.10);`;
              for (const observee of recipient.msgobs.observing) {
                let txt = `Observing: ${observee.name}`;
                if (token.getAttribute('title')) { txt = `${token.getAttribute('title')}, ${txt};`; }
                token.setAttribute('title', txt);
              }
            }
          }

          // set observer style and text for existing observer
          if (recipient.msgobs.observers) {
            for (const observer of recipient.msgobs.observers) {
              if (id.defaultValue == observer.id) {
                token.style = `background-color: ${options.get('observerColour')}; border-color: rgba(0,0,0,0.10);`;
                let txt = `Observing: ${recipient.name}`;
                if (!token.getAttribute('title')?.contains(txt)) {
                  if (token.getAttribute('title')) txt = `${token.getAttribute('title')}, ${txt};`;
                  token.setAttribute('title', txt);
                }
              }

            }
          }
        }
        break;
      case 'gradebook':
        const gradeTokens = document.querySelectorAll(`${elements.get('gradesWindowClass')} ${elements.get('gradesRecipientElem')}`);
        for (const token of gradeTokens) {
          const tokenId = $(token).data('id');
          if (tokenId == recipient.id) {
            if (recipient.msgobs.observers) {
              for (const observer of recipient.msgobs.observers) {
                let txt = `Observed by: ${recipient.name}`;
                if (token.getAttribute('title')) { txt = `${token.getAttribute('title')}, + ${txt};`; }
                token.setAttribute('title', txt);
              }
            }
          }

          if (recipient.msgobs.observers) {
            for (const observer of recipient.msgobs.observers) {
              if (tokenId == observer.id) {
                token.style.backgroundColor = options.get('observerColour');
                token.style.borderColor = `rgba(0,0,0,0.10)`;
                let txt = `Observing: ${recipient.name}`;
                if (token.getAttribute('title')) { txt = `${token.getAttribute('title')}, ${txt};`; }
                token.setAttribute('title', txt);
              }

            }
          }
        }
        break;
    }
  }


  function doCanvasUiMessage(msgTxt, type, duration) {
    // Uses the Canvas page flash message element to show a message. 
    try {
      let flashMessageElem = document.querySelector(elements.get('flashMessageElem'));
      let msg = document.createElement('div');
      let html = `<li class="ic-flash-${type}" aria-hidden="true" style="z-index: 2;">
                          <div class="ic-flash__icon">
                              <i class="icon-check"></i>
                          </div>
                              ${msgTxt}
                          <button type="button" class="Button Button--icon-action close_link" aria-label="Close">
                              <i class="icon-x"></i>
                          </button>
                      </li>`;
      msg.innerHTML = html;
      flashMessageElem.appendChild(msg);
      if (duration) {
        setTimeout(() => {
          msg.remove();
        }, duration);
      }
    } catch {
      alert(msgTxt);
    }

  }

  function deDupePeople(people) {
    // Filter an array of users for users with the same user_id property.
    return (people.filter((person, index, arr) => {
      return arr.findIndex(elem => {
        return elem.id === person.id;
      }) === index;
    }));
  }

  function associateEnrolmentData(recipients, enrolments) {
    // Add enrolment data from context course to recipient user data
    // Adds Observers to recipients who have observers in the context course 
    for (let recipient of recipients) {
      recipient.msgobs = { observers: [], observing: [] };
      for (const enrolment of enrolments) {
        if (recipient.id === enrolment.user_id) {
          recipient.msgobs.role = enrolment.type;
          if (enrolment.observed_user) {
            recipient.msgobs.observing.push(enrolment.observed_user);
          }
        }
        if (isObserver(recipient, enrolment)) {
          recipient.msgobs.observers.push(enrolment.user);

        }
      }
    }
  }

  function isObserver(user, observer) {
    // Return true if 'user' is observed by 'observer'.
    return observer.role == 'ObserverEnrollment' && user.id === observer.observed_user?.id;
  }

  async function getPeople(queryList, context) {
    // Get users from a list of Canvas recipient query strings.
    let { courses, courseSubgroups, sections, groups, users } = sortQueries(queryList);
    let result = [];
    if (courses.length != 0) result.push(await getCourseUsers(courses));
    if (courseSubgroups.length != 0) result.push(await getCourseSubgroupUsers(courseSubgroups));
    if (sections.length != 0) result.push(await getSectionUsers(sections));
    if (groups.length != 0) result.push(await getGroupUsers(groups));
    if (users.length != 0) result.push(await getMulitpleUsersInCourse(users, context));
    result = result.flat(10);
    return result;
  }

  function sortQueries(queries) {
    // Sort Canvas recipient query strings into arrays of their type.
    let result = {
      courses: [],
      courseSubgroups: [],
      sections: [],
      groups: [],
      users: []
    };

    for (let query of queries) {
      query = new String(query);
      if (/^course_[0-9]*$/.test(query)) { result.courses.push(query); }
      if (query.startsWith('section_')) { result.sections.push(query); }
      if (query.startsWith('group_')) { result.groups.push(query); }
      if (/^course_[0-9]*_[a-z]*/.test(query)) { result.courseSubgroups.push(query); }
      if (/^[0-9]/.test(query)) { result.users.push(query); }
    }

    return result;
  }

  async function getCourseEnrolments(courseIds) {
    // Get course enrolments from a list of course IDs (with or without prefix).
    let courseEnrolments = [];
    for (let id of courseIds) {
      if (id.startsWith('course_')) id = id.split('_')[1];
      const result = await req({ path: `/api/v1/courses/${id}/enrollments?include=observed_users&per_page=100` });
      courseEnrolments.push(...result);
    }
    courseEnrolments = courseEnrolments.flat(1);
    return courseEnrolments;
  }

  async function getCourseSubgroupUsers(courseSubgroupIds) {
    // Get user objects from a Canvas course subgroup type (e.g course_1234_teachers)
    let courseSubgroupEnrolments = [];
    for (const courseSubgroupId of courseSubgroupIds) {
      let [, id, subgroup] = courseSubgroupId.split('_');
      subgroup = subgroup.slice(0, -1);
      const result = await req({ path: `/api/v1/courses/${id}/users?enrollment_type[]=${subgroup}&per_page=100` });
      courseSubgroupEnrolments.push(...result);
    }
    return courseSubgroupEnrolments;
  }

  async function getSectionUsers(sectionIds) {
    // Get user objects from a section.
    // Note: Can't locate teachers in a given section, only students.
    let sectionEnrolments = [];
    for (let id of sectionIds) {
      if (id.startsWith('section_')) id = id.split('_')[1];
      const result = await req({ path: `/api/v1/sections/${id}?include=students&per_page=100` });
      sectionEnrolments.push(...result[0].students);
    }
    return sectionEnrolments;
  }

  async function getGroupUsers(groupIds) {
    // Get user objects from a Group ID.
    let groupEnrolments = [];
    for (let id of groupIds) {
      if (id.startsWith('group_')) id = id.split('_')[1];
      const result = await req({ path: `/api/v1/groups/${id}/users?per_page=100` });
      groupEnrolments.push(result);
    }
    return groupEnrolments;
  }

  async function getCourseUsers(courseIds) {
    // Get user objects from a Course ID. 
    let courseUsers = [];
    for (let id of courseIds) {
      if (id.startsWith('course_')) id = id.split('_')[1];
      const result = await req({ path: `/api/v1/courses/${id}/users?per_page=100` });
      courseUsers.push(...result);
    }
    return courseUsers;
  }

  async function getUserInCourse(userIds, context) {
    // Get a single user objects from a single course context. 
    let courseUsers = [];
    for (let id of userIds) {
      if (context.startsWith('course_')) context = context.split('_')[1];
      const result = await req({ path: `/api/v1/courses/${context}/users/${id}` });
      courseUsers.push(...result);
    }
    return courseUsers;
  }

  async function getMulitpleUsersInCourse(userIds, context) {
    // Get multiple user objects from a single course context. 
    let result = [];
    if (context.startsWith('course_')) context = context.split('_')[1];
    let courseUsers = await req({ path: `/api/v1/courses/${context}/users?per_page=100` });
    courseUsers = courseUsers.flat(3);
    for (const id of userIds) {
      for (const user of courseUsers) {
        if (id == user.id) result.push(user);
      }
    }
    return result;
  }

  async function getCurrentUserEnrolments() {
    // Get user's course enrollments'
    let result = await req({ path: `/api/v1/users/self/enrollments?per_page=100` });
    result = result.flat(3);
    return result;
  }

  async function getCourse(id) {
    // Get a details of a single course
    let result = await req({ path: `/api/v1/courses/${id}` });
    result = result.flat(3);
    return result;
  }

  function getHeaders() {
    // Returns headers for fetch request
    if (options.get('useToken')) {
      return new Headers({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${options.get('token')}` });
    } else {
      return new Headers({ 'Content-Type': 'application/json' });
    }
  }

  async function req(requestOptions) {
    // Returns result of an XHR request, including additional pages. 
    try {
      // Query the Canvas API. 
      const { path: path } = requestOptions;
      let result = [];
      const response = await fetch(`${path}`, { headers: getHeaders() });
      const jsonData = JSON.parse(sanatize(await response.text()));
      result.push(jsonData);
      // Check for additional page link definition in headers
      if (response.headers.get('link')) {
        let paginationLinks = splitHeaderLinks(response.headers.get('link'));

        // Get additional pages.
        if (paginationLinks.get('next')) {
          do {
            let page = await fetch(paginationLinks.get('next'), { headers: getHeaders() });
            paginationLinks = splitHeaderLinks(page.headers.get('link'));
            result.push(JSON.parse(sanatize(await page.text())));
          } while (paginationLinks.get('current') !== paginationLinks.get('last'));
        }
      }
      return result;
    } catch (e) {
      doCanvasUiMessage(`An Error Occured. Please refresh the page and try again. \n ${e}`, 'error', 60000);
    }

  }

  function sanatize(data) {
    // Removes while(1); prefix from Canvas JSON data. 
    return data.replace(/^while\(1\);/g, '');
  }

  async function message(msgData) {
    // Sends a conversations message.
    const msg = await fetch(`/api/v1/conversations`, {
      headers: getHeaders(),
      method: 'POST',
      body: JSON.stringify({ recipients: [], body: '' })
    });
  }

  function splitHeaderLinks(links) {
    // Process header links.
    let headerLinks = new Map();
    for (const link of links.matchAll(/(?:<(.*?)>).*?(?:rel="(.*?)")/g)) {
      headerLinks.set(link[2], link[1]);
    }
    return headerLinks;
  }

  init();
}
