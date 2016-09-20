// ==UserScript==
// @name        msgobs | Message Observers
// @namespace   msgobs
// @include     https://your-institution-here.test.instructure.com/*
// @include     https://your-institution-here.instructure.com/*
// @version     v0.01
// @grant       none
// ==/UserScript==

//If you are using TamperMonkey / GreaseMonkey you will need to update the above URLs
// to your own canvas instance. Don't forget the * after the trailing slash to ensure the script runs on all pages
// Alternativley you can specify which pages this script should run on from the GreaseMonkey
// control panel.

//The above UserScript block may be removed if you are not using GreaseMonkey or TamperMonkey etc

/*
 * MSGOBS v0.01
 * https://github.com/sdjrice/msgobs
 * Stephen Rice
 * srice@scc.wa.edu.au
 */

var msgobs = {
  options: {
    colour: 'bisque', //colour for observers. Use any HTML colour like '#FF0000' or 'red'
    observersText: 'Include Observers', //include observers button text.
    removeText: 'Remove Students', // remove students button text.
    busyText: 'Working...', //text to display while observers are being processed.
    btnWidth: '110px',
    log: true, //output log in the browser console.
  },

  init: function() {
    //init for conversations page (inbox) or gradebook page
    if (window.location.href.indexOf('/conversations') !== -1 && this.conversations) {
      msgobs.log('Launching Conversations');
      this.launch('conversations');
    } else if (window.location.href.indexOf('/gradebook') !== -1 && this.gradebook) {
      msgobs.log('Launching Gradebook');
      this.launch('gbook');
    }
  },

  launch: function(type) {

    msgobs.log('----------------');
    msgobs.log('MSGOBS');
    msgobs.log('v0.01');
    msgobs.log('https://github.com/sdjrice/msgobs');
    msgobs.log('Stephen Rice');
    msgobs.log('srice@scc.wa.edu.au');
    msgobs.log('----------------');

    this.common.init();

    switch (type) {
      case 'conversations':
        this.conversations.init();
        break;
      case 'gbook':
        this.gradebook.init();
        break;
    }
  },

  common: {
    els: {
      flashMessage: $('#flash_message_holder'), //Canvas message flasher (appears top center of screen-ish).
    },
    txt: {
      noStudents: 'There are no students in the recipient list.',
      noStudentsRmv: 'There are no students in the recipient list.',
      addObsSuccess: 'Observers added successfully.',
      addObsNone: 'No observers were found.',
      addObsGroup: 'Observer lookup is not available for group entries. Group recipient entries will be skipped.',
      removedStudents: 'Removed students.',
      noRecipients: 'There are no recipients in the recipient list.',
    },

    init: function() {
      //create button objects with classes from default Canvas buttons. May need classes updated in the future.
      this.btnAddObs = $('<div>' + msgobs.options.observersText + '</div>').addClass('ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only').css({
        'margin': '0 2px',
        'min-width': msgobs.options.btnWidth
      });
      this.btnRmvStu = $('<div>' + msgobs.options.removeText + '</div>').addClass('ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only').css({
        'margin': '0 2px',
        'min-width': msgobs.options.btnWidth
      });
    },

    getCsrfToken: function() {
      //returns secret cookie token
      var csrfToken = document.cookie.slice(document.cookie.indexOf('_csrf_token=') + 12);
      if (csrfToken.indexOf(';') !== -1) { //depending on the order of the cookie vars the csrf may be at end of string. Therefore, there will be no semicolon. Chrome.
        csrfToken = csrfToken.slice(0, csrfToken.indexOf(';'));
      }
      return csrfToken;
    },

    getEnrolments: function(ids, mode, callback) {
      // Returns an object populated with enrolment items from a given list of
      // course, user or section IDs.
      // ids: list of ids for relevant mode, mode = url string e.g 'courses'

      function collatedEnrolments() {
        this.total = ids.length;
        this.count = 0;
        this.enrolments = [];
      }

      var enrolments = new collatedEnrolments();

      //handle the enrolment result from each API call (one for each section);
      var handle = function(data) {
        //add each result to enrolments result object
        enrolments.enrolments.push(data);
        enrolments.count++;
        if (enrolments.count >= enrolments.total) {
          //oncomplete, merge results and call callback function.
          var allEnrolments = [];
          enrolments.enrolments.forEach(function(v) {
            allEnrolments = allEnrolments.concat(v);
          });
          callback(allEnrolments);
        }
      };

      ids.forEach(function(id) {
        //for each id, get enrolments with the handle function
        msgobs.xhr.get('/api/v1/' + mode + '/' + id + '/enrollments?per_page=100000', handle);
      });
    },

    getCourseEnrolments: function(courseId, callback) {
      msgobs.xhr.get('/api/v1/courses/' + courseId + '/enrollments?per_page=100000', callback);
    },

    getCourseSections: function(courseId, callback) {
      var handle = function(data) {
        var sections = [];
        data.forEach(function(v) {
          if (sections.indexOf(v.id) === -1) {
            sections.push(v.id);
          }
        });
        callback(sections);
      };
      msgobs.xhr.get('/api/v1/courses/' + courseId + '/sections?per_page=100000', handle);
    },

    getMatchedObservers: function(ids, enrolments) {
      //returns associated_users given an array of ids (of students)
      var observerIds = [];
      var inserted = [];
      enrolments.forEach(function(enrolment) {
        //act on observers with associated_user_id specified
        if (enrolment.type === 'ObserverEnrollment' && enrolment.associated_user_id !== null) {
          ids.forEach(function(v) { //compare with given id list
            if (enrolment.associated_user_id == v.id) {
              var observerData = {
                id: enrolment.user_id,
                name: enrolment.user.name,
                observing: v.name
              };
              //omit duplicate entries, add additional observees to existing entry.
              var duplicate = inserted.indexOf(observerData.id);
              if (duplicate === -1) {
                observerIds.push(observerData);
                inserted.push(observerData.id);
              } else {
                if (observerIds[duplicate].observing.indexOf(v.name) === -1) {
                  observerIds[duplicate].observing += ', ' + v.name;
                }
              }
            }
          });
        }
      });

      return observerIds;
    },

    notify: function(msg, type) {
      var time = new Date();
      time = time.getMilliseconds();
      var msgSuccess = $('<li id="msgobs-notification-' + time + '" class="ic-flash-' + type + '" aria-hidden="true" style="z-index: 2;"><div class="ic-flash__icon"><i class="icon"></i></div>' + msg + '<button type="button" class="Button Button--icon-action close_link"><i class="icon-x"></i></button></li>');
      this.els.flashMessage.append(msgSuccess);
      //remove the message after a 5 secs.
      setTimeout(function() {
        $('#msgobs-notification-' + time).fadeOut(function() {
          $(this).remove();
        });
      }, 5000);
    },

  },

  conversations: {
    runOnce: 0,
    step: 0,
    els: {
      dialog: '.compose-message-dialog',
      btnContainer: '.attachments',
      courseId: 'input[name=context_code]',
      recipientList: '.ac-token-list',
      recipientEl: '.ac-token'
    },
    init: function() {
      var ctx = this;
      //set bindings for buttons
      var messagebox = document.getElementsByTagName('body');
      msgobs.common.btnAddObs.bind('click', function() {
        msgobs.conversations.getObserversInit();
      });

      msgobs.common.btnRmvStu.bind('click', function() {
        msgobs.conversations.removeStudentsInit();
      });

      //Some elements are loaded dynamaically after the page load. Loop to test
      //whether they're there yet. Previously used a mutationobserver.

      var readyCheck = function(callback) {
        if ($(msgobs.conversations.els.dialog).length) {
          msgobs.log(msgobs.conversations.els.dialog + ' found.');
          msgobs.conversations.insertUi();
        } else {
          msgobs.log(msgobs.conversations.els.dialog + ' element not ready.');
          setTimeout(function() {
            callback(callback);
          }, 500);
        }
      };
      readyCheck(readyCheck);
    },

    insertUi: function() {
      if (window.ENV.current_user_roles.indexOf('teacher') !== -1 || window.ENV.current_user_roles.indexOf('admin') !== -1) {
        $(this.els.btnContainer, this.els.dialog).append(msgobs.common.btnAddObs, msgobs.common.btnRmvStu);
        msgobs.log('Teacher/Admin role detected. UI inserted.');
      } else {
        msgobs.log('No teacher/admin role detected.');
        msgobs.log(window.ENV.current_user_roles);
      }
    },

    setMode: function() {
      this.courseID = $(this.els.courseId, this.dialog).attr('value');
      if (this.courseID.indexOf('course_') !== -1) {
        this.courseID = this.courseID.replace('course_', '');
        this.mode = 'course';
      } else {
        this.mode = 'user';
      }
      msgobs.log('Mode: ' + this.mode);
      msgobs.log('Course_ID: ' + this.Course_ID);
    },

    getObserversInit: function() {
      msgobs.log('Getting Observers Init..');
      this.step = 0;
      this.mode = '';

      var recipients = this.getRecipientIds();
      if (!recipients.length) {
        msgobs.common.notify(msgobs.common.txt.noRecipients, 'warning');
      } else {
        //warn the user if they have put groups in the recipient list
        //groups currently will not be looked up.

        var groupsPresent = false;
        recipients.forEach(function(v) {
          if (v.id.indexOf('course') !== -1) {
            groupsPresent = true;
          }
        });

        if (groupsPresent) {
          msgobs.common.notify(msgobs.common.txt.addObsGroup, 'warning');
        }

        this.setMode(); //set whether a course context has been selects
        this.getObservers(); //start!
      }
    },

    getObservers: function(data) {
      this.step++;
      msgobs.log('-----------------');
      msgobs.log('GetObservers Mode: [' + this.mode + '] Step: ' + this.step);

      var callback = function getObservers(data) {
        msgobs.conversations.getObservers(data);
      };

      var courses, sections, enrolments, recipients, observers;

      switch (this.mode) {
        case 'user':
          switch (this.step) {
            case 1:
              var users = [];
              this.getRecipientIds().forEach(function(v) {
                users.push(v.id);
              });
              if (users.length > 0) {
                msgobs.log('Getting all enrolments for all users..');
                msgobs.common.btnAddObs.addClass('disabled').text(msgobs.options.busyText);
                msgobs.common.getEnrolments(users, 'users', callback);
              } else {
                msgobs.common.notify(msgobs.common.txt.noRecipients, 'warning');
              }
              break;
            case 2:
              msgobs.log('User enrolment data');
              msgobs.log(data);

              //Create array of each of the courses and sections that users are enrolled in
              courses = [];
              sections = [];
              data.forEach(function(v) {
                if (courses.indexOf(v.course_id) === -1) {
                  courses.push(v.course_id);
                }

                if (sections.indexOf(v.course_section_id) === -1) {
                  sections.push(v.course_section_id);
                }

              });

              //Get enrolments of each of the arrays of course and section codes!
              msgobs.common.getEnrolments(sections, 'sections', callback);
              msgobs.common.getEnrolments(courses, 'courses', callback);
              break;
            case 3:
              //we don't actually know which data this is, just whichever finished first
              msgobs.log(data);
              this.enrolments = data;
              break;
            case 4:
              //all enrolment data is present, concatenate
              enrolments = this.enrolments.concat(data);
              msgobs.log('Concatenated enrolments:');
              msgobs.log(enrolments);
              //get recipient ids from list element
              recipients = this.getRecipientIds();
              msgobs.log('Recipients:');
              msgobs.log(recipients);
              //match asssociated_user_id with ids from recipient list element
              observers = msgobs.common.getMatchedObservers(recipients, enrolments);
              msgobs.log('Matched observers:');
              msgobs.log(observers);

              if (observers.length) {
                msgobs.common.notify(msgobs.common.txt.addObsSuccess, 'success');
                observers.forEach(function(v) {
                  msgobs.conversations.insert(v);
                  msgobs.log('Inserted results.');
                });
              } else {
                msgobs.common.notify(msgobs.common.txt.addObsNone, 'warning');
                msgobs.log('No observer matches.');
              }

              msgobs.common.btnAddObs.removeClass('disabled').text(msgobs.options.observersText);

              break;
          }
          break;
        case 'course':
          switch (this.step) {
            case 1:
              msgobs.common.btnAddObs.addClass('disabled').text(msgobs.options.busyText);
              msgobs.log('Getting course enrolments');
              msgobs.common.getEnrolments([this.courseID], 'courses', callback);
              break;
            case 2:
              msgobs.log('Course Enrolments: ');
              msgobs.log(data);
              this.courseEnrolments = data;
              msgobs.log('Getting course sections:');
              msgobs.common.getCourseSections(this.courseID, callback);
              break;
            case 3:
              msgobs.log('Course Sections: ');
              msgobs.log(data);
              msgobs.common.getEnrolments(data, 'sections', callback);
              break;
            case 4:
              enrolments = this.courseEnrolments.concat(data);
              msgobs.log('All Enrolments: ');
              msgobs.log(enrolments);
              recipients = this.getRecipientIds();
              msgobs.log('Recipients:');
              msgobs.log(recipients);
              observers = msgobs.common.getMatchedObservers(recipients, enrolments);
              console.log(observers);
              msgobs.log('Matched observers:');
              msgobs.log(observers);
              //complete!
              if (observers.length) {
                msgobs.common.notify(msgobs.common.txt.addObsSuccess, 'success');
                observers.forEach(function(v) {
                  msgobs.conversations.insert(v);
                });
                msgobs.log('Inserted results.');
              } else {
                msgobs.common.notify(msgobs.common.txt.addObsNone, 'warning');
                msgobs.log('No observers found');
              }

              msgobs.common.btnAddObs.removeClass('disabled').text(msgobs.options.observersText);
              break;
          }

          break;
      }


    },

    getRecipientIds: function() {
      //return recipients from list element
      var recipients = [];
      $(this.els.recipientEl, this.els.dialog).each(function(index, obj) {
        recipients.push({
          id: $('input', obj).attr('value'),
          name: ''
        }); //get the text name;
      });
      return recipients;
    },

    insert: function(observer) {
      //add a list item, might need to update these classes occasionally.
      var obj = $('<li class="ac-token" data-type="observer" style="background-color: ' + msgobs.options.colour + '; border-color: rgba(0,0,0,0.10);">' + observer.name + '<a href="#" class="ac-token-remove-btn"><i class="icon-x icon-messageRecipient--cancel"></i><span class="screenreader-only">Remove recipient ' + observer.name + '</span></a><input name="recipients[]" value="' + observer.id + '" type="hidden"></li>');
      $(this.els.recipientList, this.els.dialog).append(obj);
    },

    removeStudentsInit: function() {
      //remove students. Unfortunately also needs an api lookup since user roles
      //don't appear to be associated with list items.
      msgobs.log('Removing Students');
      this.removeStep = 0;
      this.setMode();
      this.removeStudents();
    },

    removeStudents: function(data) {
      var ctx = this;
      this.removeStep++;
      msgobs.log('------------------------');
      msgobs.log('Remove Students Mode: [' + this.mode + '] Step: ' + this.removeStep);

      var callback = function(result) {
        msgobs.conversations.removeStudents(result);
      };

      var recipients, removal;

      switch (this.mode) {
        case 'user':
          switch (this.removeStep) {
            case 1:
              //look up user enrolments.
              if (this.getRecipientIds().length) {
                msgobs.common.btnRmvStu.addClass('disabled').text(msgobs.options.busyText);
                recipients = this.getRecipientIds();
                var ids = [];
                recipients.forEach(function(v) {
                  ids.push(v.id);
                });
                msgobs.log('Getting Enrolments for users.');
                msgobs.common.getEnrolments(ids, 'users', callback);
              } else {
                msgobs.common.notify(msgobs.common.txt.noStudentsRmv, 'warning');
              }
              break;
            case 2:
              //process for enrolment type.
              msgobs.log('User Enrolments:');
              msgobs.log(data);
              recipients = this.getRecipientIds();
              msgobs.log('Recipient IDs:');
              msgobs.log(recipients);

              //Where users have a students enrolmentType, queue for removal
              removal = [];
              recipients.forEach(function(v) {
                var enrolmentType = ctx.getEnrolmentStatus(v.id, data);
                if (enrolmentType.indexOf('StudentEnrollment') !== -1) {
                  removal.push(v.id);
                }
              });
              //remove matched StudentEnrollment ids.
              msgobs.log('Matched StudentEnrollment removal IDs:');
              msgobs.log(removal);
              this.removeById(removal);
              msgobs.common.btnRmvStu.removeClass('disabled').text(msgobs.options.removeText);
              break;
          }
          break;
        case 'course':
          switch (this.removeStep) {
            case 1:
              //lookup course enrolments.
              if (this.getRecipientIds().length) {
                msgobs.common.btnRmvStu.addClass('disabled').text(msgobs.options.busyText);
                msgobs.log('Getting Enrolments for users.');
                msgobs.common.getEnrolments([this.courseID], 'courses', callback);
              } else {
                msgobs.common.notify(msgobs.common.txt.noStudentsRmv, 'warning');
              }
              //now that I look at this, I think it's missing sections. Probably should fix that soon.
              break;
            case 2:
              msgobs.log('Course Enrolments: ');
              msgobs.log(data);
              this.courseEnrolments = data;
              msgobs.log('Getting course sections:');
              msgobs.common.getCourseSections(this.courseID, callback);
              break;
            case 3:
              msgobs.log('Course Sections: ');
              msgobs.log(data);
              msgobs.common.getEnrolments(data, 'sections', callback);
              break;
            case 4:
              enrolments = this.courseEnrolments.concat(data);

              msgobs.log('All Enrolments: ');
              msgobs.log(data);
              recipients = this.getRecipientIds();
              removal = [];
              recipients.forEach(function(v) {
                var enrolmentType = ctx.getEnrolmentStatus(v.id, enrolments);
                if (enrolmentType.indexOf('StudentEnrollment') !== -1) {
                  removal.push(v.id);
                }
              });
              msgobs.log('Matched StudentEnrollment removal IDs:');
              msgobs.log(removal);
              this.removeById(removal);
              msgobs.common.btnRmvStu.removeClass('disabled').text(msgobs.options.removeText);
              break;
          }
          break;
      }
    },

    removeById: function(removal) {
      //remove ids from list element given an array of ids.
      var removed = false;
      $(this.els.recipientEl, this.els.dialog).each(function(index, obj) {
        var id = $('input', obj).attr('value');
        if (removal.indexOf(id) !== -1) {
          $(this).remove();
          removed = true;
        }
      });

      if (removed) {
        msgobs.common.notify(msgobs.common.txt.removedStudents, 'success');
      } else {
        msgobs.common.notify(msgobs.common.txt.noStudentsRmv, 'warning');
      }

    },

    getEnrolmentStatus: function(user, enrolments) {
      var type = [];
      enrolments.forEach(function(v) {
        if (v.user_id == user) {
          type.push(v.type);
        }
      });
      return type;
    }
  },

  gradebook: {
    messageSent: false,
    step: 0,
    runOnce: 0,
    els: {
      gradetable: document.getElementById('gradebook-grid-wrapper'), //container for grades, monitored for mutations
      dialog: '#message_students_dialog', //container for message box
      bodyClassCoursePrefix: 'context-course_', //prefix for course context code found in body class
      btnContainer: $('.button-container', '#message_students_dialog'), //msgbox button container
      inputMessageTypes: $('.message_types', '#message_students_dialog'), //student criteria dropdown
      inputScoreCutoff: $('.cutoff_holder', '#message_students_dialog'), //when score criteria is selected, input for no. val appears
      inputFormFields: $('.cutoff_holder, #subject, #body', '#message_students_dialog'), //all form fields (for validation)
      inputSubject: $('#subject'), //msg subject field
      inputBody: $('#body'), //msg body field
      btnCanvasSend: $('.button-container .send_button', '#message_students_dialog'), //default canvas send button
      btnMsgobsSend: $('<div type="submit" class="Button Button--primary send_button disabled msgobs_sender" aria-disabled="true">Send Message</div>'), //replacement button with alternate send action
      btnCanvasClose: '.ui-dialog-titlebar-close', //close button for msgbox
      studentList: $('.student_list', '#message_students_dialog'),
      studentClass: '.student', //class for student list items.
    },

    init: function() {
      msgobs.common.btnAddObs.bind('click', function() {
        msgobs.gradebook.getObserversInit();
      }).css('float', 'left');
      msgobs.common.btnRmvStu.bind('click', function() {
        msgobs.gradebook.removeStudents();
      }).css('float', 'left');

      var courseId = $('body').attr('class');
      courseId = courseId.slice(courseId.indexOf(this.els.bodyClassCoursePrefix) + this.els.bodyClassCoursePrefix.length);
      courseId = courseId.slice(0, courseId.indexOf(' '));
      this.courseId = courseId;

      msgobs.log('Course ID: ' + this.courseId);

      //check to see if element is ready for modification.
      var readyCheck = function(callback) {
        if ($(msgobs.gradebook.els.dialog).length) {
          msgobs.log(msgobs.gradebook.els.dialog + ' found.');
          msgobs.gradebook.els.dialog = $(msgobs.gradebook.els.dialog);
          msgobs.gradebook.insertUi();
        } else {
          msgobs.log(msgobs.gradebook.els.dialog + ' element not ready.');
          setTimeout(function() {
            callback(callback);
          }, 500);
        }
      };

      readyCheck(readyCheck);
    },

    insertUi: function() {
      if (msgobs.gradebook.runOnce === 0) {
        msgobs.gradebook.runOnce = 1;

        //Action setup
        msgobs.gradebook.els.btnContainer.prepend(msgobs.common.btnAddObs, msgobs.common.btnRmvStu);

        msgobs.gradebook.els.inputMessageTypes.change(function() {
          msgobs.gradebook.removeObservers();
        });

        msgobs.gradebook.els.inputScoreCutoff.bind('keyup', function() {
          msgobs.gradebook.removeObservers();
        });

        msgobs.gradebook.els.inputFormFields.bind('keyup', function() {
          msgobs.gradebook.validate();
        });

        msgobs.gradebook.els.btnMsgobsSend.bind('click', function() {
          msgobs.gradebook.submit();
        });
        msgobs.log('UI Inserted.');
      }
    },

    getObserversInit: function() {
      msgobs.log('--------------------');
      msgobs.log('Getting Observers...');
      this.step = 0;
      this.getObservers();
    },

    getObservers: function(data) {
      this.step++;
      msgobs.log('--------------------');
      msgobs.log('Gradebook Step: ' + msgobs.gradebook.step);

      var callback = function(result) {
        msgobs.gradebook.getObservers(result);
      };

      switch (this.step) {
        case 1:
          this.removeObservers(); //cleanup previously inserted observers

          //swap buttons to prevent Canvas actions on send click.
          msgobs.gradebook.els.btnCanvasSend.remove();
          msgobs.gradebook.els.btnContainer.append(msgobs.gradebook.els.btnMsgobsSend);
          msgobs.common.btnAddObs.addClass('disabled').text(msgobs.options.busyText);
          if (!this.getStudentList().length) { // no studetns
            msgobs.common.notify(msgobs.common.txt.noStudents, 'warning');
            msgobs.common.btnAddObs.removeClass('disabled').text(msgobs.options.observersText);
          } else {
            //Get course enrolments.
            msgobs.log('Course: ' + this.courseId);
            msgobs.common.getEnrolments([this.courseId], 'courses', callback);
          }
          break;
        case 2:
          //store result of enrolments, get sections of present course.
          msgobs.log('Course Enrolments: ');
          msgobs.log(data);
          this.courseEnrolments = data;
          msgobs.common.getCourseSections(this.courseId, callback);
          break;
        case 3:
          //lookup enrolments of sections found in previous step
          msgobs.log('Course Sections: ');
          msgobs.log(data);
          msgobs.common.getEnrolments(data, 'sections', callback);
          break;
        case 4:
          //finalise the process
          msgobs.log('Course Section Enrolments: ');
          msgobs.log(data);
          //concanentate earlier course enrolments with section enrolments.
          var courseEnrolments = this.courseEnrolments.concat(data);
          msgobs.log('All Course Enrolments: ');
          msgobs.log(courseEnrolments);
          //match student names to ids. Vulnerable to identical names.
          var studentIds = this.getStudentIds(this.getStudentList(), courseEnrolments);
          msgobs.log('Student IDs: ');
          msgobs.log(studentIds);
          //Match user's observing ids to student ids
          var observerIds = msgobs.common.getMatchedObservers(studentIds, courseEnrolments);
          msgobs.log('Matched observers: ');
          msgobs.log(observerIds);
          //insert the tokens to the ui, complete process with feedback.
          this.insert(observerIds);
          msgobs.common.btnAddObs.removeClass('disabled').text(msgobs.options.observersText);
          msgobs.common.notify(msgobs.common.txt.addObsSuccess, 'success');
          break;
      }
    },

    getStudentList: function() {
      //return list of student names from recipient list element.
      var namelist = [];
      var students = $(msgobs.gradebook.els.studentClass, msgobs.gradebook.els.studentList);
      students.each(function() {
        if ($(this).attr('style').indexOf('list-item') >= 0) {
          namelist.push({
            name: $('.name', $(this)).text(),
            obj: this
          });
        }
      });
      return namelist;
    },

    getStudentIds: function(studentNames, enrolments) {
      //returns student ids from students names matched with ids found in enrolment data
      var ids = [];
      studentNames.forEach(function(studentName) {
        enrolments.forEach(function(enrolment, i) {
          if (enrolment.user.name == studentName.name) {
            ids.push({
              id: enrolment.user.id,
              name: studentName.name
            });
            $(studentName.obj).attr('data-id', enrolment.user.id);
          }
        });
      });
      return ids;
    },

    insert: function(list) {
      //insert elements into ui.
      list.forEach(function(v) {
        var item = $('<li class="parent" data-id="' + v.id + '" title="Observing: ' + v.observing + '" style="display: list-item; background-color: ' + msgobs.options.colour + '; border-color: rgba(0,0,0,0.10);"><span class="name">' + v.name + '</span><div class="remove-button Button Button--icon-action" title="Remove ' + v.name + ' from recipients" aria-disabled="false"><i class="icon-x"></i></div></li>');
        $('.remove-button', item).click(function() {
          $(this).parent().remove();
        });
        msgobs.gradebook.els.studentList.append(item);
      });

      this.validate();
    },

    validate: function() {
      //check message readiness and update button state.
      var subject = msgobs.gradebook.els.inputSubject.val();
      var body = msgobs.gradebook.els.inputBody.val();
      var recipients = 0;
      $('li', msgobs.gradebook.els.studentList).each(function() {
        if ($(this).attr('style').indexOf('list-item') !== -1) {
          recipients++;
        }
      });

      if (subject.length > 0 && body.length > 0 && recipients > 0 && this.messageSent === false) {
        msgobs.gradebook.els.btnMsgobsSend.removeClass('disabled');
      } else {
        msgobs.gradebook.els.btnMsgobsSend.addClass('disabled');
      }
    },

    getRecipients: function() {
      //return list of recipient items from student list element.
      var recipients = [];
      $('li', msgobs.gradebook.els.studentList).each(function() {
        el = $(this);
        //if the item is displayed, it should be part of the message recipients.
        if (el.attr('style').indexOf('list-item') !== -1) {
          recipients.push(el.attr('data-id'));
        }
      });
      return recipients;
    },

    submit: function() {
      msgobs.log('Sending Message...');
      //send the message
      if (this.messageSent === true) {
        return false;
      }

      //Build mega data string. Couldn't get sending JSON object to work :(
      var data = 'utf8=%E2%9C%93'; //odd tick character
      data += '&authenticity_token=' + msgobs.common.getCsrfToken();
      data += '&recipients=' + this.getRecipients().toString(',');
      data += '&group_conversation=true';
      data += '&bulk_message=true';
      data += '&context_code=course_' + this.courseId;
      data += '&mode=async';
      data += '&subject=' + msgobs.gradebook.els.inputSubject.val();
      data += '&body=' + msgobs.gradebook.els.inputBody.val();
      data += '&_method=post';

      msgobs.log('Data: ' + data);

      //oncomplete function
      var callback = function(res, status) {
        msgobs.gradebook.cleanup(true);
        msgobs.gradebook.messageSent = false;
        $(msgobs.gradebook.els.btnCanvasClose).click();
        msgobs.log('XHR Status ' + status);
        if (status == '202' || status == '200') {
          msgobs.common.notify('Message sent!', 'success');
        } else {
          msgobs.common.notify('An error occured. Your message was not sent.', 'error');
        }
      };

      msgobs.xhr.post('/api/v1/conversations', data, callback);
      this.messageSent = true;
      this.validate();
    },

    cleanup: function(silent) {
      msgobs.log('Cleaning up: ');
      this.removeStudents(silent);
      this.removeObservers();
    },

    removeObservers: function() {

      $('.parent', this.els.studentList).remove();
      //put the normal button back because we're not messaging parents anymore.
      msgobs.gradebook.els.btnMsgobsSend.detach();
      msgobs.gradebook.els.btnContainer.append(msgobs.gradebook.els.btnCanvasSend);
      msgobs.log('Observers removed');
    },

    removeStudents: function(silent) {
      msgobs.log('Students removed');
      var failed = 1;
      $('.student', msgobs.gradebook.els.dialog).each(function() {
        if ($(this).attr('style').indexOf('display: list-item') >= 0) {
          failed = 0;
        }
      });
      if (failed === 1) {
        if (!silent) {
          msgobs.common.notify(msgobs.common.txt.noStudentsRmv, 'warning');
        }
      } else {
        $('.student', msgobs.gradebook.els.dialog).attr('style', 'display: none;');
        if (!silent) {
          msgobs.common.notify(msgobs.common.txt.removedStudents, 'success');
        }
      }
    }
  },

  xhr: {
    //xhr stuff. pretty generic
    get: function(url, callback) {
      var req = new XMLHttpRequest();
      var handle = function() {
        var res = this.responseText;
        res = JSON.parse(res.replace('while(1);', ''));
        callback(res, this.status);
      };

      req.onload = handle;
      req.open("GET", url);
      req.send();
    },

    post: function(url, data, callback) {
      var req = new XMLHttpRequest();

      var handle = function() {
        var res = this.responseText;
        var status = this.status;
        res = JSON.parse(res.replace('while(1);', ''));
        callback(res, status);
      };

      req.onload = handle;
      req.open("POST", url, true);
      req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      req.send(data);
    },
  },

  logItems: [],
  log: function(msg, warn, err) {
    var date = new Date();

    function zero(str) {
      return str.toString().length < 2 ? '0' + str : str;
    } //derp. no idea how to use dates.

    stamp = '[' + zero(date.getHours()) + ':' + zero(date.getMinutes()) + ':' + zero(date.getSeconds()) + '] ';
    if (msgobs.options.log) {
      console.log(stamp + JSON.stringify(msg));
    }
    this.logItems.push(stamp + JSON.stringify(msg));
  },
  applog: function() {
    console.dir(logitems);
  }
};

$(document).ready(function() {
  msgobs.init();
});
