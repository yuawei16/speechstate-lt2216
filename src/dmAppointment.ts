/*
    What can this DM It can fufill task 1 and partial task 2. The reason why it did not fullfill the task 2 is that I am confused about
    how data input should be saved. I tried to understand the SDSContext interface and tried to save the data input there, but it was not
    so sucessful. The flow of states are quite linear. I tried to create parallel and nested states, but it did not work.
*/
// import { title } from "process";
// import { Context } from "microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common.speech/RecognizerConfig";
import { MachineConfig, send, Action, assign } from "xstate";


function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

const sayAppointment: Action<SDSContext, SDSEvent> = send((context: SDSContext) => ({
    type: "SPEAK", value: `Do you want to create a meeting titled ${context.title} on ${context.day}`
}))

const grammar: { [index: string]: { title?: string, day?: string, time?: string, userName?: string, famousPersonName?: string} } = {
    "Lecture.": { title: "Dialogue systems lecture" },
    "Lunch.": { title: "Lunch at the canteen" },
    "CelebrityMetting": {title: "Meeting with Jackie Chan"},
    "Monday": { day: "Monday" },
    "10:30": { time: "10:30" },
    "Jack": {userName: "Jack"},
    "famousPerson": {famousPersonName: "Jackie Chan"}
}



const kbRequest = (text: string) =>
    fetch(new Request(`https://cors.eu.org/https://api.duckduckgo.com/?q=${text}&format=json&skip_disambig=1`)).then(data => data.json())

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'idle',
    states: {
        idle: {
            on: {
                CLICK: 'init'
            }
        },
        init: {
            on: {
                TTS_READY: 'welcome',
                CLICK: 'welcome'
            }
        },
        welcome: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'openning',
                        actions: [assign({ userName: (context) => grammar[context.recResult[0].utterance].userName! }),
                                    (context) => console.log("Here's the userName", context.userName)]
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Tell me your name"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                },
            }
        },
        openning: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'meetingWelcome',
                        cond: (context) => context.recResult[0].utterance === 'Alone.'
                    },
                    {
                        target: 'meetingWithOther',
                        cond: (context) => context.recResult[0].utterance === 'Another'
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Hi," + grammar["Jack"].userName + "Do you want to create a meeting alone or with another one?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                }
            }
        },
        meetingWithOther: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'findPerson',
                        actions: [assign({ famousPersonName: (context) => grammar["famousPerson"].famousPersonName! }),
                                    (context) => console.log(context.famousPersonName)]
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Who is X?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                }

                }
        },
        findPerson: {
            initial: 'prompt',
            states: {
                prompt: {
                    entry: say("Let me check."),
                    on: { ENDSPEECH: 'getPerson' }
                },
                getPerson: {
                    invoke: {
                        id: 'getPerson',
                        src: (grammar) => kbRequest(grammar.famousPersonName),
                        onDone: {
                            target: 'success',
                            actions: [
                                assign({ personSpec: (context, event) => event.data.Abstract}),
                                (context, event) => console.log(context, event),
                                (grammar) => console.log(grammar.personSpec)
                            ]
                        },
                        onError: {
                            target: 'fail',
                            actions: (context, event) => console.log(context, event)
                        }
                    }
                },
                success: {
                    entry: send((context: SDSContext) => ({
                        type: "SPEAK", value: context.personSpec
                    })),
                    on: { ENDSPEECH: '#root.dm.meetingFamousPerson' }
                },
                fail: {},
            },
        },
        meetingFamousPerson:{
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'date',
                        cond: (context) => context.recResult[0].utterance === 'Yes.',
                        actions: [assign({ title: (context) => "meeting with" + context.famousPersonName} ),
                                    (context) => console.log(context.title)]

                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Do you want to meet" + grammar["famousPerson"].famousPersonName),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                }
            }
        },
        meetingWelcome: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'date',
                        cond: (context) => "title" in (grammar[context.recResult[0].utterance] || {}),
                        actions: assign({ title: (context) => grammar[context.recResult[0].utterance].title! })
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Let's create a meeting. What is it about?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                }
            }
        },
        date:{
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'daypart',
                        actions: [assign({ day: (context) => grammar[context.recResult[0].utterance].day! }),
                                (context) => console.log("Date Step", context)]
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("On which day is it?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                }
            }
        },
        daypart:{
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'gettime',
                        cond: (context) => context.recResult[0].utterance === 'No.' 
                    },
                    {
                        target: 'meetingConfirmationWholeDay',
                        cond: (context) => context.recResult[0].utterance === 'Yes.'
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Will it take the whole day?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                }
            }
        },
        gettime: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'meetingConfirmationPartDay',
                        actions: [assign({ title: (context) => grammar[context.recResult[0].utterance].time! }),
                                  (grammar) => console.log(grammar)]
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("What time is your meeting?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                }
            }
        },
        meetingConfirmationPartDay: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'meetingWelcome',
                        cond: (context) => context.recResult[0].utterance === 'No.'
                    },
                    {
                        target: 'finalConfirmation',
                        cond: (context) => context.recResult[0].utterance === 'Yes.'
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Do you want to create a meeting titled" + grammar["Lunch."].title 
                               + "on" + grammar["Monday"].day + "at" + grammar["10:30"].time + "?"),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                }
            }
        },
        meetingConfirmationWholeDay: {
            initial: 'prompt',
            on: {
                RECOGNISED: [
                    {
                        target: 'meetingWelcome',
                        cond: (context) => context.recResult[0].utterance === 'No.'
                    },
                    {
                        target: 'finalConfirmation',
                        cond: (context) => context.recResult[0].utterance === 'Yes.',
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: sayAppointment,
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                }
            }
        },
        finalConfirmation: {
            entry: say("Your meeting has been created!")
        },
        info: {
            entry: send((context) => ({
                type: 'SPEAK',
                value: `OK, ${context.title}`
            })),
            on: { ENDSPEECH: 'init' }
        }
    }
})

