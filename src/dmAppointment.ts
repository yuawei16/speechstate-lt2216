import { title } from "process";
import { MachineConfig, send, Action, assign } from "xstate";


function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

const grammar: { [index: string]: { title?: string, day?: string, time?: string } } = {
    "Lecture.": { title: "Dialogue systems lecture" },
    "Lunch.": { title: "Lunch at the canteen" },
    "Monday": { day: "Monday" },
    "10:30": { time: "10:30" },
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
                        // cond: (context) => "title" in (grammar[context.recResult[0].utterance] || {}),
                        actions: [assign({ title: (context) => grammar[context.recResult[0].utterance].day! }),
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
                        // cond: (context) => "day" in (grammar[context.recResult[0].utterance] || {}),
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
                        target: 'finalConfirmation',
                        // cond: (context) => "day" in (grammar[context.recResult[0].utterance] || {}),
                        // actions: assign({ time: (context) => grammar[context.recResult[0].utterance].time! })
                    },
                    {
                        target: 'welcome',
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
                    entry: say("Do you want to create a meeting titled" + grammar["Lunch."].title + "on" + grammar["Monday"].day + "at" + grammar["10:30"].time + "?"),
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
                        target: 'finalConfirmation',
                        // cond: (context) => "day" in (grammar[context.recResult[0].utterance] || {}),
                        // actions: assign({ time: (context) => grammar[context.recResult[0].utterance].time! })
                    },
                    {
                        target: 'welcome',
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
                    entry: say("Do you want to create a meeting titled" + grammar["Lunch."].title + "on" + grammar["Monday"].day + "?"),
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

// const kbRequest = (text: string) =>
//     fetch(new Request(`https://cors.eu.org/https://api.duckduckgo.com/?q=${text}&format=json&skip_disambig=1`)).then(data => data.json())
