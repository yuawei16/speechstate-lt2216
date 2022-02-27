/*
    Refine DM so that it can:
        1. Switch to Idle when prompt is repeated 3 times
        2. When "Help" is given, DM switches to previous state
        3. When the confidence is over 0.6, DM will use it. Otherwise, a prompt is given and ask again.
*/

import { MachineConfig, send, Action, assign } from "xstate";


function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

const grammar: { [index: string]: { title?: string, day?: string, time?: string } } = {
    "Lecture.": { title: "Dialogue systems lecture" },
    "Lunch.": { title: "Lunch at the canteen" },
    "On Friday.": { day: "Friday" },
    "At 10": { time: "10:00" },
}

const sayAppointment: Action<SDSContext, SDSEvent> = send((context: SDSContext) => ({
    type: "SPEAK", value: `Do you want to create a meeting titled ${context.title} on ${context.day}`
}))

const kbRequest = (text: string) =>
    fetch(new Request(`https://cors.eu.org/https://api.duckduckgo.com/?q=${text}&format=json&skip_disambig=1`)).then(data => data.json())

const thresHold = 0.6


function meetingWithOther(targetState: string): MachineConfig<SDSContext, any, SDSEvent> {
    return {
        id: 'meetingWithOther',
        entry: assign({counter: (context) => context.counter = 0}),
        initial: 'prompt',
        on: {
            RECOGNISED: [
                {
                    target: '.findPerson',
                    actions: assign({ famousPersonName: (context) => context.recResult[0].utterance }),
                    cond: (context) => context.recResult[0].confidence > thresHold
                },
                {
                    target: '.clarify',
                },
                {
                    target: 'openning.hist',
                    cond: (context) => context.recResult[0].utterance === 'Help.',              
                },
                {
                    target: '.nomatch'
                }
            ],
            TIMEOUT: [{target: '.prompt', cond: (context) => context.counter < 3},
                      {target: '#root.dm.init', cond: (context) => context.counter > 3}]
        },
        states: {
            prompt: {
                entry: [say("Who is X?"), assign({counter: (context) => context.counter+1})],
                on: { ENDSPEECH: 'ask' }
            },
            ask: {
                entry: send('LISTEN')
            },
            clarify:{
                entry: send((context: SDSContext) => ({
                    type: "SPEAK", value: `Sorry, I am not sure about ${context.recResult[0].utterance}. 
                                          Please repeat.`})),
                on: {ENDSPEECH: 'ask'}
            },
            nomatch: {
                entry: say("Sorry, I don't know what it is. Tell me something I know."),
                on: { ENDSPEECH: 'ask' }
            },  

            findPerson: {  
                id: 'findPerson',
                initial: 'prompt',
                states: {
                    prompt: {
                        entry: say("Let me check."),
                        on: { ENDSPEECH: 'getPerson' }
                    },
                    getPerson: {
                        invoke: {
                            id: 'getPerson',
                            src: (context) => kbRequest(context.famousPersonName),
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
                            // Only the first 2 descriptions are taken here to save time.
                            type: "SPEAK", value: context.personSpec.split('.').slice(0,1)
                        })),
                        on: { ENDSPEECH: '#meetingWithOther.meetingFamousPerson' }
                    },
                    fail: {},
                    hist: {
                        type: 'history',
                        history: 'deep'
                    }
                }
            },
            meetingFamousPerson:{
                id: 'meetingFamousPerson',
                entry: assign({counter: (context) => context.counter = 0}),
                initial: 'prompt',
                on: {
                    RECOGNISED: [
                        {
                            target: targetState,
                            cond: (context) => context.recResult[0].utterance === 'Yes.',
                            actions: [assign({ title: (context) => "meeting with" + context.famousPersonName} ),
                                        (context) => console.log(context.title)]
    
                        },
                        {
                            target: '#findPerson.hist',
                            cond: (context) => context.recResult[0].utterance === 'Help.',              
                        },
                        {
                            target: '.nomatch'
                        }
                    ],
                    TIMEOUT: [{target: '.prompt', cond: (context) => context.counter < 3},
                              {target: '#root.dm.init', cond: (context) => context.counter > 3}]
                },
                states: {
                    prompt: {
                        entry: [send((context: SDSContext) => ({type: "SPEAK", value: `Do you want to meet ${context.famousPersonName}?`})),
                                assign({counter: (context) => context.counter+1})],
                        on: { ENDSPEECH: 'ask' }
                    },
                    ask: {
                        entry: send('LISTEN'),
                    },
                    nomatch: {
                        entry: say("Sorry, I don't know what it is. Tell me something I know."),
                        on: { ENDSPEECH: 'ask' }
                    },
                    hist: {
                        type: 'history',
                        history: 'deep'
                    }
                }
            },
            hist: {
                type: 'history',
                history: 'deep'
            }        
        }   
    }
}

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
            entry: assign({counter: (context) => context.counter = 0}),
            on: {
                RECOGNISED: [
                    {
                        target: 'openning',
                        actions: assign({ userName: (context) => context.recResult[0].utterance}),
                        cond: (context) => context.recResult[0].confidence > thresHold
                    },
                    {
                        target: '.clarify',
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: [{target: '.prompt', cond: (context) => context.counter < 3},
                          {target: '#root.dm.init', cond: (context) => context.counter > 3}]
            },
            states: {
                prompt: {
                    entry: [say("Welcome! Tell me your name please."), 
                            assign({counter: (context) => context.counter+1})],
                    on: { ENDSPEECH: 'ask'}
                    
                },
                ask: {
                    entry: send('LISTEN')
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                },
                clarify:{
                    entry: send((context: SDSContext) => ({
                        type: "SPEAK", value: `Sorry, I am not sure about ${context.recResult[0].utterance}. 
                                              Please repeat.`})),
                    on: {ENDSPEECH: 'ask'}
                },
                hist: {
                    type: 'history',
                    history: 'deep'
                }
               
            }
        },
        openning: {
            initial: 'prompt',
            entry: assign({counter: (context) => context.counter = 0}),
            on: {
                RECOGNISED: [
                    {
                        target: 'meetingWelcome',
                        cond: (context) => context.recResult[0].utterance === 'Alone.' && 
                                           context.recResult[0].confidence > 0.5    // Loose the confidece because it is hard to get value over 0.6 for this word.
                              

                    },
                    {
                        target: 'meetingCelebrity',
                        cond: (context) => context.recResult[0].utterance === 'Another one.' &&
                                            context.recResult[0].confidence > thresHold
                    },
                    {
                        target: 'welcome.hist',
                        cond: (context) => context.recResult[0].utterance === 'Help.',
                    },
                    {
                        target: '.clarify',
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: [{target: '.prompt', cond: (context) => context.counter < 3},
                          {target: '#root.dm.init', cond: (context) => context.counter > 3}]
            },
            states: {
                prompt: {
                    entry: [send((context: SDSContext) => ({type: "SPEAK", value: `Hi, ${context.userName}! 
                                                           Need help? Just say help! Do you want to create a meeting alone or with another one?`})),
                            assign({counter: (context) => context.counter+1})],

                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                clarify:{
                    entry: send((context: SDSContext) => ({
                        type: "SPEAK", value: `Sorry, I am not sure about ${context.recResult[0].utterance}. 
                                              Please repeat.`})),
                    on: {ENDSPEECH: 'ask'}
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                },
                hist: {
                    type: 'history',
                    history: 'deep'
                },
            }
        },
        meetingCelebrity: {
            ...meetingWithOther('#root.dm.date')
        },
        meetingWelcome: {
            initial: 'prompt',
            entry: assign({counter: (context) => context.counter = 0}),
            on: {
                RECOGNISED: [
                    {
                        target: 'date',
                        cond: (context) => "title" in (grammar[context.recResult[0].utterance] || {}) &&
                                           context.recResult[0].confidence > thresHold,
                        actions: assign({ title: (context) => grammar[context.recResult[0].utterance].title! })
                    },
                    {
                        target: '.clarify',
                    },
                    {
                        target: '#root.dm.openning.hist',
                        cond: (context) => context.recResult[0].utterance === 'Help.',              
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: [{target: '.prompt', cond: (context) => context.counter < 3},
                          {target: '#root.dm.init', cond: (context) => context.counter > 3}]
            },
            states: {
                prompt: {
                    entry: [say("Let's create a meeting. What is it about?"),
                            assign({counter: (context) => context.counter+1})],
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                clarify:{
                    entry: send((context: SDSContext) => ({
                        type: "SPEAK", value: `Sorry, I am not sure about ${context.recResult[0].utterance}. 
                                              Please repeat.`})),
                    on: {ENDSPEECH: 'ask'}
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                },
                hist: {
                    type: 'history',
                    history: 'deep'
                },
            }
        },
        date:{
            initial: 'prompt',
            entry: assign({counter: (context) => context.counter = 0}),
            on: {
                RECOGNISED: [
                    // Take the date in the grammar
                    {
                        target: 'daypart',
                        cond: (context) => grammar[context.recResult[0].utterance] !== undefined &&
                                           context.recResult[0].confidence > thresHold,
                        actions: assign({ day: (context) => grammar[context.recResult[0].utterance].day! })  
                    },
                    // If the date is not in the garmmar, save the date to context
                    {
                        target: 'daypart',
                        cond: (context) => grammar[context.recResult[0].utterance] === undefined &&
                                                   context.recResult[0].confidence > thresHold &&
                                                   context.recResult[0].utterance !== "Help.",
                        actions: [assign({ day: (context) => {let dayStr = context.recResult[0].utterance;
                                                              let newStr = dayStr.split(' ')[1];
                                                            return newStr}}),
                                        (context) => console.log("Date Step 252", context)]
                        
                    },
                    {
                        target: '#root.dm.meetingCelebrity.hist',
                        cond: (context) => context.recResult[0].utterance === 'Help.' && context.famousPersonName !== undefined        
                    },
                    {
                        target: '#root.dm.meetingWelcome.hist',
                        cond: (context) => context.recResult[0].utterance === 'Help.' && context.famousPersonName === undefined        
                    },
                    {
                        target: '.clarify',
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: [{target: '.prompt', cond: (context) => context.counter < 3},
                          {target: '#root.dm.init', cond: (context) => context.counter > 3}]
            },
            states: {
                prompt: {
                    entry: [say("On which day is it?"),
                            assign({counter: (context) => context.counter+1})],
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                },
                clarify:{
                    entry: send((context: SDSContext) => ({
                        type: "SPEAK", value: `Sorry, I am not sure about ${context.recResult[0].utterance}. 
                                              Please repeat.`})),
                    on: {ENDSPEECH: 'ask'}
                    },
                hist: {
                    type: 'history',
                    history: 'deep'
                },
            }
        },
        daypart:{
            initial: 'prompt',
            entry: assign({counter: (context) => context.counter = 0}),
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
                        target: '#root.dm.date.hist',
                        cond: (context) => context.recResult[0].utterance === 'Help.'
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: [{target: '.prompt', cond: (context) => context.counter < 3},
                          {target: '#root.dm.init', cond: (context) => context.counter > 3}]
            },
            states: {
                prompt: {
                    entry: [say("Will it take the whole day?"),
                            assign({counter: (context) => context.counter+1})],    
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                },
                hist: {
                    type: 'history',
                    history: 'deep'
                }
            }
        },
        gettime: {
            initial: 'prompt',
            entry: assign({counter: (context) => context.counter = 0}),   
            on: {
                RECOGNISED: [
                    {
                        target: 'meetingConfirmationPartDay',
                        cond: (context) => context.recResult[0].utterance !== 'Help.' &&
                                           context.recResult[0].confidence > thresHold,
                        actions: [assign({ title: (context) => grammar[context.recResult[0].utterance].time! }),
                                  (grammar) => console.log(grammar)]
                    },
                    {
                        target: '#root.dm.daypart.hist',
                        cond: (context) => context.recResult[0].utterance === 'Help.',              
                    },
                    {
                        target: '.clarify',
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: [{target: '.prompt', cond: (context) => context.counter < 3},
                          {target: '#root.dm.init', cond: (context) => context.counter > 3}]
            },
            states: {
                prompt: {
                    entry: [say("What time is your meeting?"),
                            assign({counter: (context) => context.counter+1})], 
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                },
                clarify:{
                    entry: send((context: SDSContext) => ({
                        type: "SPEAK", value: `Sorry, I am not sure about ${context.recResult[0].utterance}. 
                                              Please repeat.`})),
                    on: {ENDSPEECH: 'ask'}
                },
                hist: {
                    type: 'history',
                    history: 'deep'
                }
            }
        },
        meetingConfirmationPartDay: {
            initial: 'prompt',
            entry: assign({counter: (context) => context.counter = 0}),
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
                        target: '#root.dm.daypart.hist',
                        cond: (context) => context.recResult[0].utterance === 'Help.',              
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: [{target: '.prompt', cond: (context) => context.counter < 3},
                          {target: '#root.dm.init', cond: (context) => context.counter > 3}]
            },
            states: {
                prompt: {
                    entry: [say("Do you want to create a meeting titled " + grammar["Lunch."].title
                               + "on " + grammar["On Friday."].day + "at " + grammar["At 10"].time + "?"),
                               assign({counter: (context) => context.counter+1})],
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                },
                hist: {
                    type: 'history'
                }
            }
        },
        meetingConfirmationWholeDay: {
            initial: 'prompt',
            entry: assign({counter: (context) => context.counter = 0}),
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
                        target: '#root.dm.daypart.hist',
                        cond: (context) => context.recResult[0].utterance === 'Help.',              
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: [{target: '.prompt', cond: (context) => context.counter < 3},
                          {target: '#root.dm.init', cond: (context) => context.counter > 3}]
            },
            states: {
                prompt: {
                    entry: [sayAppointment,
                            assign({counter: (context) => context.counter+1})],
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                },
                hist: {
                    type: 'history'
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
        },
        hist: {
            type: 'history',
            history: 'deep'
        },
        alone: {}
    }
})