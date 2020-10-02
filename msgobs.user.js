// ==UserScript==
// @name        Message Observers
// @namespace   msgobs
// @include     https://canvas.test.instructure.com/*
// @include     https://canvas.instructure.com/*
// @version     v0.08
// @grant       none
// ==/UserScript==

// If you are using TamperMonkey / GreaseMonkey you will need to update the above URLs
//  to your own canvas instance. Don't forget the * after the trailing slash to ensure the script runs on all pages
//  Alternativley you can specify which pages this script should run on from the GreaseMonkey
//  control panel.

// The above UserScript block may be removed entirely if you are not using GreaseMonkey or TamperMonkey etc, and are
// instead applying the script to your entire site.

/*
 * MSGOBS v0.08
 * https:// github.com/sdjrice/msgobs
 * Stephen Rice
 * srice@scc.wa.edu.au
 */

/*
  * Please Note:
  * There are currently two somewhat separate observer lookup methods within this script
  * The older method, which wasn't well suited to handling group lookups will be
  * removed, following a big code cleanup.
  * Sorry about that.
  */

var msgobs = {
  options: {
    colour: 'bisque', // colour for observers. Use any HTML colour like '#FF0000' or 'red'
    observersText: 'Include Observers', // include observers button text.
    removeText: 'Remove Students', //  remove students button text.
    busyText: 'Working...', // text to display while observers are being processed.
    btnWidth: '110px',
    autoTickIndividualMsgCheckbox: true,
    log: false // output log in the browser console.
  },

  init: function () {
    // init for conversations page (inbox) or gradebook page
    if (window.location.href.indexOf('/conversations') !== -1 && this.conversations) {
      msgobs.log('Launching Conversations');
      this.launch('conversations');
    } else if (window.location.href.indexOf('/gradebook') !== -1 && this.gradebook) {
      msgobs.log('Launching Gradebook');
      this.launch('gbook');
    }
  },

  launch: function (type) {
    console.log('----------------');
    console.log('MSGOBS \n v0.08 \nhttps://github.com/sdjrice/msgobs');
    console.log('Stephen Rice \nsrice@scc.wa.edu.au');
    console.log('----------------');

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
      flashMessage: $('#flash_message_holder') // Canvas message flasher (appears top center of screen-ish).
    },
    txt: {
      noStudents: 'There are no students in the recipient list.',
      noStudentsRmv: 'There are no students in the recipient list.',
      addObsSuccess: 'Observers added successfully.',
      addObsNone: 'No observers were found.',
      removedStudents: 'Removed students.',
      noRecipients: 'There are no recipients in the addressee field.',
      noContext: 'Notice: You have not selected a course context for your search. The observer lookup may take some time and will include observer matches from <strong>all courses.</strong>',
      noContextRmv: 'Notice: You have not selected a course context for your search. The removal lookup will remove recipients who have a student enrolment in <strong>any course.</strong>',
      noNewObservers: 'The recipient list already included all matched observers.',
      groupExpansion: 'Your recipient list contains groups. Groups will be expanded into their respective members.'
    },

    init: function () {
      // create button objects with classes from default Canvas buttons. May need classes updated in the future.
      this.btnAddObs = $('<div>' + msgobs.options.observersText + '</div>').addClass('ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only').css({
        'margin': '0 2px',
        'min-width': msgobs.options.btnWidth
      });
      this.btnRmvStu = $('<div>' + msgobs.options.removeText + '</div>').addClass('ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only').css({
        'margin': '0 2px',
        'min-width': msgobs.options.btnWidth
      });
    },

    getCsrfToken: function () {
      // returns secret cookie token
      var csrfToken = document.cookie.slice(document.cookie.indexOf('_csrf_token=') + 12);
      if (csrfToken.indexOf(';') !== -1) { // depending on the order of the cookie vars the csrf may be at end of string. Therefore, there will be no semicolon. Chrome.
        csrfToken = csrfToken.slice(0, csrfToken.indexOf(';'));
      }
      return csrfToken;
    },

    searchObjArray: function (arr, search) {
      var match = -1;
      arr.forEach(function (item, i) {
        for (var key in item) {
          if (item[key] === search) {
            match = i;
          }
        }
      });
      return match; // for consistency with indexOf comparisons
    },

    getEnrolmentsRecursively: {
      Enrolments: function (callback, resultsObj) {
        this.complete = callback;
        this.recursiveResults = [];
        this.resultsObj = resultsObj;
      },

      init: function (options, callback, results) {
        var enrolments = new this.Enrolments(callback, results);
        var operator = (options.query.indexOf('?') !== -1) ? '&' : '?';
        msgobs.xhr.get('/api/v1/' + options.mode + '/' + options.id + '/' + options.query + operator + 'per_page=100' + options.type, this.proc, enrolments);
      },

      proc: function (res, status, enrolments, link) {
        var ctx = msgobs.common.getEnrolmentsRecursively;

        if (res.forEach) {
          res.forEach(function (v) {
            enrolments.recursiveResults.push(v);
          });
        } else {
          enrolments.recursiveResults.push(res);
        }

        if (link && link.indexOf('next') !== -1) { // is there a next page?
          var next = ctx.parseNextLink(link); // get the next link
          msgobs.xhr.get(next, ctx.proc, enrolments); // get the next page
        } else {
          enrolments.complete(enrolments.recursiveResults, status, enrolments.resultsObj);
        }
      },

      parseNextLink: function (link) {
        link = link.match(/,<.*>;.rel="next"/);
        link = link[0].match(/<.*>/);
        link = link[0].replace(/<|>/g, '');
        return link;
      }
    },

    getObservers: {
      init: function (recipients, context, callback) {
        msgobs.log('--Observers 2.0--');

        function Observers () {
          this.contexts = [context];
          this.contexts.count = 0;
          this.contexts.total = 0;

          this.contexts.getCount = 0;

          this.expand = [];
          this.expand.count = 0;
          this.expand.total = 0;

          this.users = [];
          this.users.simplified = [];

          this.enrolments = [];

          this.observers = [];

          this.callback = callback;

          this.matchFlag = 0;
        }

        var results = new Observers();

        this.sortRecipients(recipients, results);
        this.process.init(results);
      },

      sortRecipients (recipients, results) {
        recipients.forEach(function (id) {
          id = id.split('_');

          switch (id.length) {
          case 1:
            // user id
            results.expand.push(['user', id[0]]);
            break;
          case 2:
            // course, section
            results.expand.push([id[0], id[1]]);
            break;
          case 3:
            // course, section, type
            results.expand.push([id[0], id[1], id[2]]);
            break;
          }
        });
      },

      process: {
        init: function (results) {
          msgobs.log(results);
          this.expand(results);
          results.expand.total = results.expand.length;
        },

        handle: function (data, status, results) {
          results.expand.count++;
          if (data.forEach) {
            data.forEach(function (v) {
              if (v.user) {
                results.users.push(v.user);
              } else {
                results.users.push(v);
              }
            });
          } else {
            results.users.push(data);
          }

          msgobs.log('Expand count: ' + results.expand.count + ' Total: ' + results.users.length);

          if (results.expand.count === results.expand.total) {
            results.users.forEach(function (v) {
              results.users.simplified.push({
                id: v.id,
                name: v.name,
                userObj: v
              });
            });
            msgobs.common.getObservers.process.lookup.init(results);
          }
        },

        expand: function (results) {
          var callback = this.handle;
          results.expand.forEach(function (v) {
            var type = '';

            if (v[2]) {
              type = (v[2].slice(0, v[2].length - 1)); // remove plural
              type = '&enrollment_type=' + type;
            }

            // at some point this will need to be made per user
            var options = false;

            switch (v[0]) {
            case 'user':
              if (results.contexts[0] === 'none') {
                options = {
                  mode: 'users',
                  id: v[1],
                  query: '',
                  type: ''
                };
              } else {
                options = {
                  mode: 'courses',
                  id: results.contexts[0],
                  query: 'users/' + v[1],
                  type: ''
                };
              }
              break;
            case 'course':
              options = {
                mode: 'courses',
                id: v[1],
                query: 'users',
                type: type
              };
              break;
            case 'section':
              options = {
                mode: 'sections',
                id: v[1],
                query: 'enrollments',
                type: ''
              };
              break;
            case 'group':
              options = {
                mode: 'groups',
                id: v[1],
                query: 'users',
                type: ''
              };
              break;
            }
            msgobs.common.getEnrolmentsRecursively.init(options, callback, results);
          });
        },

        lookup: {
          init: function (results) {
            msgobs.log('--- Getting Enrollments ---');
            results.contexts.total = results.contexts.length;
            if (results.contexts[0] === 'none') {
              results.contexts.pop();
              this.getContexts.init(results);
            } else {
              this.enrolments(results);
            }
          },

          getContexts: {
            init: function (results) {
              msgobs.log('No context for lookup, getting contexts from user enrolments.');
              results.contexts.getCount = 0;
              this.contexts(results);
            },

            contexts: function (results) {
              var callback = this.handle;
              results.users.forEach(function (v) {
                var options = {
                  mode: 'users',
                  id: v.id,
                  query: 'enrollments?state=active',
                  type: ''
                };
                msgobs.common.getEnrolmentsRecursively.init(options, callback, results);
              });
            },

            handle: function (data, status, results) {
              results.contexts.getCount++;
              data.forEach(function (v) {
                if (results.contexts.indexOf(v.course_id) === -1) { // don't make duplicates
                  results.contexts.push(v.course_id);
                }
              });
              msgobs.log('getContextCount: ' + results.contexts.getCount + ' Total: ' + results.users.length);
              if (results.contexts.getCount === results.users.length) {
                msgobs.log('Context lookup complete.');
                msgobs.common.getObservers.process.lookup.init(results);
              }
            }

          },

          enrolments: function (results) {
            var callback = this.handle;
            results.contexts.forEach(function (v) {
              var options = {
                mode: 'courses',
                id: v,
                query: 'enrollments',
                type: ''
              };
              msgobs.common.getEnrolmentsRecursively.init(options, callback, results);
            });
          },

          handle: function (data, status, results) {
            results.contexts.count++;
            data.forEach(function (v) {
              if (v.associated_user_id) {
                results.enrolments.push(v);
              }
            });

            msgobs.log('Enrolments Count: ' + results.contexts.count + 'Total: ' + results.contexts.total);

            if (results.contexts.count === results.contexts.total) {
              msgobs.log('Completed enrolments lookup');
              msgobs.common.getObservers.process.match.init(results);
            }
          }

        },

        match: {
          init: function (results) {
            msgobs.log('--- Matching Results ---');
            this.match(results);
          },

          match: function (results) {
            results.users.forEach(function (user) {
              results.enrolments.forEach(function (enrolment) {
                msgobs.log('Comparing: ' + user.id + ' <-> ' + enrolment.associated_user_id);
                if (user.id === enrolment.associated_user_id) {
                  msgobs.log('Found a match.');
                  results.matchFlag = 1;
                  var observerData = {
                    id: enrolment.user_id,
                    name: enrolment.user.name,
                    observing: user.name,
                    userObj: enrolment.user
                  };
                  // omit duplicate entries, add additional observees to existing entry.
                  var observerDuplicate = msgobs.common.searchObjArray(results.observers, observerData.id);

                  // below is a probably pointless check
                  // var userDuplicate = msgobs.common.searchObjArray(results.users.simplified, user.id);
                  var userObserverDuplicate = msgobs.common.searchObjArray(results.users.simplified, observerData.id);
                  if (observerDuplicate === -1 && userObserverDuplicate === -1) {
                    results.observers.push(observerData);
                  } else if (observerDuplicate > -1) {
                    if (results.observers[observerDuplicate].observing.indexOf(user.name) === -1) {
                      results.observers[observerDuplicate].observing += ', ' + user.name;
                    }
                  }
                }
              });
            });

            msgobs.common.getObservers.complete(results);
          }
        }

      },
      complete: function (results) {
        // maybe return the whole object, eh?
        results.callback([results.observers, results.users.simplified, results.matchFlag]);
      }
    },

    // old lookup methods below. Still used in gradebook lookups.
    getEnrolments: function (id, mode, returnCallback) {
      function CollatedEnrolments () {
        this.total = id.length;
        this.count = 0;
        this.enrolments = [];
      }

      var collatedEnrolments = new CollatedEnrolments();

      var callback = function (data) {
        // add each result to enrolments result object
        collatedEnrolments.enrolments.push(data);
        collatedEnrolments.count++;
        if (collatedEnrolments.count >= collatedEnrolments.total) {
          // oncomplete, call callback function.
          var enrolments = [];
          collatedEnrolments.enrolments.forEach(function (v) {
            enrolments = enrolments.concat(v);
          });
          returnCallback(enrolments);
        }
      };

      if (id.forEach) {
        id.forEach(function (v) {
          var options = {
            mode: mode,
            id: v,
            query: 'enrollments',
            type: ''
          };

          msgobs.common.getEnrolmentsRecursively.init(options, callback);
        });
      }
    },

    getCourseSections: function (courseId, callback) {
      var handle = function (data) {
        var sections = [];
        data.forEach(function (v) {
          if (sections.indexOf(v.id) === -1) {
            sections.push(v.id);
          }
        });
        callback(sections);
      };
      msgobs.xhr.get('/api/v1/courses/' + courseId + '/sections?per_page=100000', handle);
    },

    getMatchedObservers: function (ids, enrolments) {
      // returns associated_users given an array of ids (of students)
      var observerIds = [];
      var inserted = [];
      enrolments.forEach(function (enrolment) {
        // act on observers with associated_user_id specified
        if (enrolment.type === 'ObserverEnrollment' && enrolment.associated_user_id !== null) {
          ids.forEach(function (v) { // compare with given id list
            if (enrolment.associated_user_id == v.id) {
              var observerData = {
                id: enrolment.user_id,
                name: enrolment.user.name,
                observing: v.name
              };
              // omit duplicate entries, add additional observees to existing entry.
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

    notify: function (msg, type) {
      var time = new Date();
      time = time.getMilliseconds();
      var msgSuccess = $('<li id="msgobs-notification-' + time + '" class="ic-flash-' + type + '" aria-hidden="true" style="z-index: 2; margin-top: 7px;"><div class="ic-flash__icon"><i class="icon"></i></div>' + msg + '<button type="button" class="Button Button--icon-action close_link"><i class="icon-x"></i></button></li>');
      this.els.flashMessage.append(msgSuccess);
      // remove the message after a 5 secs.
      setTimeout(function () {
        $('#msgobs-notification-' + time).fadeOut(function () {
          $(this).remove();
        });
      }, 5000);
    }
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
    init: function () {
      msgobs.common.btnAddObs.bind('click', function () {
        msgobs.conversations.getObserversInit();
      });

      msgobs.common.btnRmvStu.bind('click', function () {
        msgobs.conversations.removeStudentsInit();
      });

      // Some elements are loaded dynamaically after the page load. Loop to test
      // whether they're there yet. Previously used a mutationobserver.

      var readyCheck = function (callback) {
        if ($(msgobs.conversations.els.dialog).length) {
          msgobs.log(msgobs.conversations.els.dialog + ' found.');
          msgobs.conversations.insertUi();
        } else {
          msgobs.log(msgobs.conversations.els.dialog + ' element not ready.');
          setTimeout(function () {
            callback(callback);
          }, 500);
        }
      };
      readyCheck(readyCheck);
    },

    insertUi: function () {
      if (window.ENV.current_user_roles.indexOf('teacher') !== -1 || window.ENV.current_user_roles.indexOf('admin') !== -1) {
        $(this.els.btnContainer, this.els.dialog).append(msgobs.common.btnAddObs, msgobs.common.btnRmvStu);
        msgobs.log('Teacher/Admin role detected. UI inserted.');
      } else {
        msgobs.log('No teacher/admin role detected.');
        msgobs.log(window.ENV.current_user_roles);
      }

      this.autoCheck();
    },

    autoCheck: function () { // check the tickbox for individual messages.
      if (msgobs.options.autoTickIndividualMsgCheckbox) {
        $('#compose-btn').on('click', function () {
          setTimeout(function () {
            if ($('#bulk_message').length) {
              $('#bulk_message').prop('checked', true);
            } else {
              msgobs.conversations.autoCheck();
            }
          }, 50);
        });
      }
    },

    setMode: function () {
      this.courseID = $(this.els.courseId, this.dialog).attr('value');
      if (this.courseID.indexOf('course_') !== -1) {
        this.courseID = this.courseID.replace('course_', '');
        this.mode = 'course';
      } else {
        this.mode = 'user';
      }
      msgobs.log('Mode: ' + this.mode);
      msgobs.log('Course_ID: ' + this.CourseID);
    },

    getObserversInit: function () {
      msgobs.log('Getting Observers Init..');
      this.step = 0;
      this.mode = '';

      var recipients = this.getRecipientIds();
      if (!recipients.length) {
        msgobs.common.notify(msgobs.common.txt.noRecipients, 'warning');
      } else {
        this.setMode(); // set whether a course context has been selected
        this.getObservers(); // start!
      }
    },

    getObservers: function (data) {
      this.step++;
      msgobs.log('-----------------');
      msgobs.log('GetObservers Mode: [' + this.mode + '] Step: ' + this.step);

      var callback = function getObservers (data) {
        msgobs.log('Returning to original Caller..');
        msgobs.conversations.getObservers(data);
      };

      var recipients = [];
      this.getRecipientIds().forEach(function (v) {
        recipients.push(v.id);
      });

      switch (this.step) {
      case 1:
        var context;
        if (this.mode === 'user') {
          context = 'none';
          msgobs.common.notify(msgobs.common.txt.noContext, 'success');
        } else {
          context = this.courseID;
        }

        var hasGroups = 0;
        recipients.forEach(function (v) {
          if (v.indexOf('course') !== -1 || v.indexOf('group') !== -1 || v.indexOf('section') !== -1) {
            hasGroups = 1;
          }
        });

        if (hasGroups) {
          msgobs.common.notify(msgobs.common.txt.groupExpansion, 'success');
        }

        msgobs.common.btnAddObs.addClass('disabled').text(msgobs.options.busyText);
        msgobs.common.btnRmvStu.addClass('disabled');
        msgobs.common.getObservers.init(recipients, context, callback);

        break;
      case 2:
        var observers = data[0];
        var users = data[1];
        var matchFlag = data[2];
        msgobs.log(observers);
        // complete!
        if (observers.length || users.length) {
          msgobs.conversations.clear();
          this.insert(users, observers);

          if (users.length && !observers.length && matchFlag) {
            msgobs.common.notify(msgobs.common.txt.noNewObservers, 'success');
          }

          if (users.length && !observers.length && !matchFlag) {
            msgobs.common.notify(msgobs.common.txt.addObsNone, 'warning');
            msgobs.log('No observers found');
          }

          if (observers.length) {
            msgobs.common.notify(msgobs.common.txt.addObsSuccess, 'success');
          }
          msgobs.log('Inserted results.');
        } else {
          msgobs.common.notify(msgobs.common.txt.addObsNone, 'warning');
          msgobs.log('No observers found');
        }
        msgobs.common.btnRmvStu.removeClass('disabled');
        msgobs.common.btnAddObs.removeClass('disabled').text(msgobs.options.observersText);
        break;
      }
    },

    getRecipientIds: function () {
      // return recipients from list element
      var recipients = [];
      $(this.els.recipientEl, this.els.dialog).each(function (index, obj) {
        recipients.push({
          id: $('input', obj).attr('value'),
          name: $(obj).text()
        });
      });
      return recipients;
    },

    clear: function () {
      var deleteTokens = conversationsRouter.compose.recipientView.tokens.slice();
      deleteTokens.forEach(function (tokenId) {
        conversationsRouter.compose.recipientView._removeToken(tokenId);
      });
    },

    insert: function (users, observers) {
      users.forEach(function (user) {
          user.userObj.id = String(user.userObj.id );
          try {
              window.conversationsRouter.compose.recipientView.setTokens([user.userObj]);
          } catch (e) {
              console.log('An error occured when adding tokens for the following user:');
              console.log(user);
              console.log(e);
          }
      });
      observers.forEach(function (user) {
          user.userObj.id = String(user.userObj.id );
          try {
            window.conversationsRouter.compose.recipientView.setTokens([user.userObj]);
        } catch (e) {
            console.log('An error occured when adding tokens for the following user:');
            console.log(user);
            console.log(e);
        }
      });

      $('.ac-token', this.els.recipientList).each(function (i, el) {
        observers.forEach(function (user) {
          if ($('input', el)[0].value === user.id.toString()) {
            $(el).attr('title', 'Linked to: ' + user.observing)
              .attr('data-type', 'observer')
              .attr('style', 'background-color:' + msgobs.options.colour + '; border-color: rgba(0,0,0,0.10);');
          }
        });

        users.forEach(function (user) {
          if ($('input', el)[0].value === user.id.toString()) {
            $(el).attr('data-type', 'user');
          }
        });
      });
    },

    removeStudentsInit: function () {
      // remove students. Unfortunately also needs an api lookup since user roles
      // don't appear to be associated with list items.
      msgobs.log('Removing Students');
      this.removeStep = 0;
      this.setMode();
      this.removeStudents();
    },

    removeStudents: function (data) {
      var ctx = this;
      this.removeStep++;
      msgobs.log('------------------------');
      msgobs.log('Remove Students Mode: [' + this.mode + '] Step: ' + this.removeStep);

      var callback = function (result) {
        msgobs.conversations.removeStudents(result);
      };

      var recipients,
        removal;

      switch (this.mode) {
      case 'user':
        switch (this.removeStep) {
        case 1:
          msgobs.common.notify(msgobs.common.txt.noContextRmv, 'success');
          // look up user enrolments.
          if (this.getRecipientIds().length) {
            msgobs.common.btnAddObs.addClass('disabled');
            msgobs.common.btnRmvStu.addClass('disabled').text(msgobs.options.busyText);
            recipients = this.getRecipientIds();
            var ids = [];
            recipients.forEach(function (v) {
              ids.push(v.id);
            });
            msgobs.log('Getting Enrolments for users.');
            msgobs.common.getEnrolments(ids, 'users', callback);
          } else {
            msgobs.common.notify(msgobs.common.txt.noStudentsRmv, 'warning');
          }
          break;
        case 2:
          // process for enrolment type.
          msgobs.log('User Enrolments:');
          msgobs.log(data);
          recipients = this.getRecipientIds();
          msgobs.log('Recipient IDs:');
          msgobs.log(recipients);

          // Where users have a students enrolmentType, queue for removal
          removal = [];
          recipients.forEach(function (v) {
            var enrolmentType = ctx.getEnrolmentStatus(v.id, data);
            if (enrolmentType.indexOf('StudentEnrollment') !== -1) {
              removal.push(v.id);
            }
          });
          // remove matched StudentEnrollment ids.
          msgobs.log('Matched StudentEnrollment removal IDs:');
          msgobs.log(removal);
          this.removeById(removal);
          msgobs.common.btnRmvStu.removeClass('disabled').text(msgobs.options.removeText);
          msgobs.common.btnAddObs.removeClass('disabled');
          break;
        }
        break;
      case 'course':
        switch (this.removeStep) {
        case 1:
          // lookup course enrolments.
          if (this.getRecipientIds().length) {
            msgobs.common.btnRmvStu.addClass('disabled').text(msgobs.options.busyText);
            msgobs.common.btnAddObs.addClass('disabled');
            msgobs.log('Getting Enrolments for users.');
            msgobs.common.getEnrolments([this.courseID], 'courses', callback);
          } else {
            msgobs.common.notify(msgobs.common.txt.noStudentsRmv, 'warning');
          }
          // now that I look at this, I think it's missing sections. Probably should fix that soon.
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
          var enrolments = this.courseEnrolments.concat(data);

          msgobs.log('All Enrolments: ');
          msgobs.log(data);
          recipients = this.getRecipientIds();
          removal = [];
          recipients.forEach(function (v) {
            var enrolmentType = ctx.getEnrolmentStatus(v.id, enrolments);
            if (enrolmentType.indexOf('StudentEnrollment') !== -1) {
              removal.push(v.id);
            }
          });
          msgobs.log('Matched StudentEnrollment removal IDs:');
          msgobs.log(removal);
          this.removeById(removal);
          msgobs.common.btnRmvStu.removeClass('disabled').text(msgobs.options.removeText);
          msgobs.common.btnAddObs.removeClass('disabled');
          break;
        }
        break;
      }
    },

    removeById: function (removal) {
      // remove ids from list element given an array of ids.
      var removed = false;
      $(this.els.recipientEl, this.els.dialog).each(function (index, obj) {
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

    getEnrolmentStatus: function (user, enrolments) {
      var type = [];
      enrolments.forEach(function (v) {
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
      gradetable: document.getElementById('gradebook-grid-wrapper'), // container for grades, monitored for mutations
      dialog: '#message_students_dialog', // container for message box
      bodyClassCoursePrefix: 'context-course_', // prefix for course context code found in body class
      btnContainer: $('.button-container', '#message_students_dialog'), // msgbox button container
      inputMessageTypes: $('.message_types', '#message_students_dialog'), // student criteria dropdown
      inputScoreCutoff: $('.cutoff_holder', '#message_students_dialog'), // when score criteria is selected, input for no. val appears
      inputFormFields: $('.cutoff_holder, #subject, #body', '#message_students_dialog'), // all form fields (for validation)
      inputSubject: $('#subject'), // msg subject field
      inputBody: $('#body'), // msg body field
      btnCanvasSend: $('.button-container .send_button', '#message_students_dialog'), // default canvas send button
      btnMsgobsSend: $('<div type="submit" class="Button Button--primary send_button disabled msgobs_sender" aria-disabled="true">Send Message</div>'), // replacement button with alternate send action
      btnCanvasClose: '.ui-dialog-titlebar-close', // close button for msgbox
      studentList: $('.student_list', '#message_students_dialog'),
      studentClass: '.student' // class for student list items.
    },

    init: function () {
      msgobs.common.btnAddObs.bind('click', function () {
        msgobs.gradebook.getObserversInit();
      }).css('float', 'left');
      msgobs.common.btnRmvStu.bind('click', function () {
        msgobs.gradebook.removeStudents();
      }).css('float', 'left');

      var courseId = $('body').attr('class');
      courseId = courseId.slice(courseId.indexOf(this.els.bodyClassCoursePrefix) + this.els.bodyClassCoursePrefix.length);
      courseId = courseId.slice(0, courseId.indexOf(' '));
      this.courseId = courseId;

      msgobs.log('Course ID: ' + this.courseId);

      // check to see if element is ready for modification.
      var readyCheck = function (callback) {
        if ($(msgobs.gradebook.els.dialog).length) {
          msgobs.log(msgobs.gradebook.els.dialog + ' found.');
          msgobs.gradebook.els.dialog = $(msgobs.gradebook.els.dialog);
          msgobs.gradebook.insertUi();
        } else {
          msgobs.log(msgobs.gradebook.els.dialog + ' element not ready.');
          setTimeout(function () {
            callback(callback);
          }, 500);
        }
      };

      readyCheck(readyCheck);
    },

    insertUi: function () {
      if (msgobs.gradebook.runOnce === 0) {
        msgobs.gradebook.runOnce = 1;

        // Action setup
        msgobs.gradebook.els.btnContainer.prepend(msgobs.common.btnAddObs, msgobs.common.btnRmvStu);

        msgobs.gradebook.els.inputMessageTypes.change(function () {
          msgobs.gradebook.removeObservers();
        });

        msgobs.gradebook.els.inputScoreCutoff.bind('keyup', function () {
          msgobs.gradebook.removeObservers();
        });

        msgobs.gradebook.els.inputFormFields.bind('keyup', function () {
          msgobs.gradebook.validate();
        });

        msgobs.gradebook.els.btnMsgobsSend.bind('click', function () {
          msgobs.gradebook.submit();
        });
        msgobs.log('UI Inserted.');
      }
    },

    getObserversInit: function () {
      msgobs.log('--------------------');
      msgobs.log('Getting Observers...');
      this.step = 0;
      this.getObservers();
    },

    getObservers: function (data) {
      this.step++;
      msgobs.log('--------------------');
      msgobs.log('Gradebook Step: ' + msgobs.gradebook.step);

      var callback = function (result) {
        msgobs.gradebook.getObservers(result);
      };

      switch (this.step) {
      case 1:
        this.removeObservers(); // cleanup previously inserted observers

        // swap buttons to prevent Canvas actions on send click.
        msgobs.gradebook.els.btnCanvasSend.remove();
        msgobs.gradebook.els.btnContainer.append(msgobs.gradebook.els.btnMsgobsSend);
        msgobs.common.btnAddObs.addClass('disabled').text(msgobs.options.busyText);
        msgobs.common.btnRmvStu.addClass('disabled');
        if (!this.getStudentList().length) { //  no studetns
          msgobs.common.notify(msgobs.common.txt.noStudents, 'warning');
          msgobs.common.btnAddObs.removeClass('disabled').text(msgobs.options.observersText);
        } else {
          // Get course enrolments.
          msgobs.log('Course: ' + this.courseId);
          msgobs.common.getEnrolments([this.courseId], 'courses', callback);
        }
        break;
      case 2:
        // store result of enrolments, get sections of present course.
        msgobs.log('Course Enrolments: ');
        msgobs.log(data);
        // finalise the process

        // concanentate earlier course enrolments with section enrolments.
        var courseEnrolments = data;
        // match student names to ids. Vulnerable to identical names.
        var studentIds = this.getStudentIds(this.getStudentList(), courseEnrolments);
        msgobs.log('Student IDs: ');
        msgobs.log(studentIds);
        // Match user's observing ids to student ids
        var observerIds = msgobs.common.getMatchedObservers(studentIds, courseEnrolments);
        msgobs.log('Matched observers: ');
        msgobs.log(observerIds);
        // insert the tokens to the ui, complete process with feedback.
        this.insert(observerIds);
        msgobs.common.btnAddObs.removeClass('disabled').text(msgobs.options.observersText);
        msgobs.common.btnRmvStu.removeClass('disabled');
        msgobs.common.notify(msgobs.common.txt.addObsSuccess, 'success');
        break;
      }
    },

    getStudentList: function () {
      // return list of student names from recipient list element.
      var namelist = [];
      var students = $(msgobs.gradebook.els.studentClass, msgobs.gradebook.els.studentList);
      students.each(function () {
        if ($(this).attr('style').indexOf('list-item') >= 0) {
          namelist.push({
            name: $('.name', $(this)).text(),
            obj: this
          });
        }
      });
      return namelist;
    },

    getStudentIds: function (studentNames, enrolments) {
      // returns student ids from students names matched with ids found in enrolment data
      var ids = [];
      studentNames.forEach(function (studentName) {
        enrolments.forEach(function (enrolment) {
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

    insert: function (list) {
      // insert elements into ui.
      list.forEach(function (v) {
        var item = $('<li class="parent" data-id="' + v.id + '" title="Observing: ' + v.observing + '" style="display: list-item; background-color: ' + msgobs.options.colour + '; border-color: rgba(0,0,0,0.10);"><span class="name">' + v.name + '</span><div class="remove-button Button Button--icon-action" title="Remove ' + v.name + ' from recipients" aria-disabled="false"><i class="icon-x"></i></div></li>');
        $('.remove-button', item).click(function () {
          $(this).parent().remove();
        });
        msgobs.gradebook.els.studentList.append(item);
      });

      this.validate();
    },

    validate: function () {
      // check message readiness and update button state.
      var subject = msgobs.gradebook.els.inputSubject.val();
      var body = msgobs.gradebook.els.inputBody.val();
      var recipients = 0;
      $('li', msgobs.gradebook.els.studentList).each(function () {
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

    getRecipients: function () {
      // return list of recipient items from student list element.
      var recipients = [];
      $('li', msgobs.gradebook.els.studentList).each(function () {
        var  el = $(this);
        // if the item is displayed, it should be part of the message recipients.
        if (el.attr('style').indexOf('list-item') !== -1) {
          recipients.push(el.attr('data-id'));
        }
      });
      return recipients;
    },

    submit: function () {
      msgobs.log('Sending Message...');
      // send the message
      if (this.messageSent === true) {
        return false;
      }

      // Build mega data string. Couldn't get sending JSON object to work :(
      var data = 'utf8=%E2%9C%93'; // odd tick character
      data += '&authenticity_token=' + msgobs.common.getCsrfToken();
      data += '&recipients=' + encodeURIComponent(this.getRecipients().toString(','));
      data += '&group_conversation=true';
      data += '&bulk_message=true';
      data += '&context_code=course_' + this.courseId;
      data += '&mode=async';
      data += '&subject=' + encodeURIComponent(msgobs.gradebook.els.inputSubject.val());
      data += '&body=' + encodeURIComponent(msgobs.gradebook.els.inputBody.val());
      data += '&_method=post';

      msgobs.log('Data: ' + data);

      // oncomplete function
      var callback = function (res, status) {
        msgobs.gradebook.cleanup(true);
        msgobs.gradebook.messageSent = false;
        $(msgobs.gradebook.els.btnCanvasClose).click();
        msgobs.log('XHR Status ' + status);
        if (status == '202' || status == '200') {
          msgobs.common.notify('Message sent!', 'success');
        } else {
          msgobs.common.notify('An error occured. Your message was not sent.', 'error');
          alert('An error occured and your message was not sent. Please copy your message below to prevent losing your beautifully crafted dialog!\n\n' + msgobs.gradebook.els.inputBody.val());
        }
      };

      msgobs.xhr.post('/api/v1/conversations', data, callback);
      this.messageSent = true;
      this.validate();
    },

    cleanup: function (silent) {
      msgobs.log('Cleaning up: ');
      this.removeStudents(silent);
      this.removeObservers();
    },

    removeObservers: function () {
      $('.parent', this.els.studentList).remove();
      // put the normal button back because we're not messaging parents anymore.
      msgobs.gradebook.els.btnMsgobsSend.detach();
      msgobs.gradebook.els.btnContainer.append(msgobs.gradebook.els.btnCanvasSend);
      msgobs.log('Observers removed');
    },

    removeStudents: function (silent) {
      msgobs.log('Students removed');
      var failed = 1;
      $('.student', msgobs.gradebook.els.dialog).each(function () {
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
    // xhr stuff. pretty generic
    get: function (url, callback, ref) {
      var req = new XMLHttpRequest();
      msgobs.log('XHR: Url: ' + url);
      var handle = function () {
        var res = this.responseText;
        res = JSON.parse(res.replace('while(1);', ''));
        msgobs.log('XHR: Response: ');
        msgobs.log(res);
        callback(res, this.status, ref, this.getResponseHeader('Link'));
      };

      req.onload = handle;
      req.open('GET', url);
      req.send();
    },

    post: function (url, data, callback) {
      var req = new XMLHttpRequest();

      var handle = function () {
        var res = this.responseText;
        var status = this.status;
        res = JSON.parse(res.replace('while(1);', ''));
        callback(res, status);
      };

      req.onload = handle;
      req.open('POST', url, true);
      req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
      req.send(data);
    }
  },

  logItems: [],
  log: function (msg) {
    var date = new Date();

    function zero (str) {
      return str.toString().length < 2 ?
        '0' + str :
        str;
    } // derp. no idea how to use dates.

    var stamp = '[' + zero(date.getHours()) + ':' + zero(date.getMinutes()) + ':' + zero(date.getSeconds()) + '] ';
    if (msgobs.options.log) {
      console.log(stamp + JSON.stringify(msg));
    }
    this.logItems.push(stamp + JSON.stringify(msg));
  },
  applog: function () {
    console.dir(this.logitems);
  }
};

$(document).ready(function () {
  msgobs.init();
});
