
// Core Imports
import React, { useState, useEffect } from 'react'
import Box from '@material-ui/core/Box'
import Card from '@material-ui/core/Card'
import Switch from '@material-ui/core/Switch'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Typography from '@material-ui/core/Typography'
import Divider from '@material-ui/core/Divider'
import Dialog from '@material-ui/core/Dialog'
import Slide from '@material-ui/core/Slide'
import blue from '@material-ui/core/colors/blue'
import Grid from '@material-ui/core/Grid'

// External Imports 
//import { Document, Page } from 'react-pdf'

// Local Imports
import LAMP from '../lamp'
import ActivityCard from './ActivityCard'
import MultipleSelect from './MultipleSelect'
import Sparkline from './Sparkline'
import MultiPieChart from './MultiPieChart'
import MenuButton from './MenuButton'
import AvatarCircleGroup from './AvatarCircleGroup'
import { groupBy } from './Utils'
import Survey from './Survey'

function SlideUp(props) { return <Slide direction="up" {...props} /> }
function _shouldRestrict() { return !['admin', 'root'].includes(LAMP.Auth._auth.id) && !LAMP.Auth._auth.id.includes('@') && (LAMP.Auth._auth.serverAddress || '').includes('.psych.digital') }

// TODO: all SensorEvents?

const addAccount = ({ id, addAccount, handleAdd }) => handleAdd();
const addAccountIndex = ({ id, accounts, addAccount, handleAdd }) =>
  handleAdd(accounts.length - 1);
var accounts = (onClick = addAccount) => [
  { id: 0, name: "0", email: "test0@test.com", image: "https://uploads-ssl.webflow.com/5d321d55bdb594133bc03c07/5d55ab4fa082a5194a78925e_Aditya-p-800.jpeg" },
  { id: 2, name: "2", email: "test2@test.com", image: "https://uploads-ssl.webflow.com/5d321d55bdb594133bc03c07/5d7958ecfedbb68c91822af2_00100dportrait_00100_W9YBE~2-p-800.jpeg" },
  { id: 3, name: "3", email: "test3@test.com", image: "https://uploads-ssl.webflow.com/5d321d55bdb594133bc03c07/5d7958d426acc67ee9e80527_00100dportrait_00100_eqH1k~2-p-800.jpeg" },
  { id: 4, name: "4", email: "test4@test.com", image: "https://uploads-ssl.webflow.com/5d321d55bdb594133bc03c07/5d8296b8eb8133e6074ec808_a_r%20copy-p-800.jpeg" },
  { id: 5, name: "5", email: "test5@test.com", image: "https://uploads-ssl.webflow.com/5d321d55bdb594133bc03c07/5d55aa09aaff48c0af1f7b1a_John-p-800.jpeg" },
  { id: 6, name: "6", email: "test6@test.com", image: "https://uploads-ssl.webflow.com/5d321d55bdb594133bc03c07/5d55ae18dd4be9bedc79ea69_Elena.jpg" },
  { id: 7, name: "7", email: "test7@test.com", image: "https://uploads-ssl.webflow.com/5d321d55bdb594133bc03c07/5d55ab00dd4be939b579b48f_Hannah-p-800.jpeg" },
  { id: 8, name: "8", email: "test8@test.com", image: "https://uploads-ssl.webflow.com/5d321d55bdb594133bc03c07/5d55ab6edd4be90af479b773_Phil-p-800.jpeg" },
  {
    id: 9,
    name: "+",
    onClick,
    style: { background: "#63D13E" }
  }
];

export default function Participant({ participant, ...props }) {
    const [ state, setState ] = useState({})
    const [ visualizations, setVisualizations ] = useState({})
    const [ activities, setActivities ] = useState([])
    const [ survey, setSurvey ] = useState()
    const [ submission, setSubmission ] = useState(0)
    const [ hiddenEvents, setHiddenEvents ] = useState([])

    useEffect(() => {
        LAMP.Type.getDynamicAttachment(participant.id, 'lamp.beta_values').then(res => {
            setState({ ...state, attachments: [JSON.parse(res.data)] })
        }).catch(() => {})
    }, [])

    useEffect(() => {
        (async () => {

        let _heatmap = (await LAMP.Type.getAttachment(participant.id, 'lamp.dashboard.experimental.heatmap')).data
        let _symptom_network = (await LAMP.Type.getAttachment(participant.id, 'lamp.dashboard.experimental.symptom-network')).data

        setVisualizations(visualizations => ({
            heatmap: _heatmap,
            symptom_network: _symptom_network
            }))
        })()
    }, [])

    useEffect(() => {
        (async () => {

            // Refresh hidden events list.
            let _hidden = await LAMP.Type.getAttachment(participant.id, 'lamp.dashboard.hidden_events')
            _hidden = !!_hidden.error ? [] : _hidden.data
            setHiddenEvents(_hidden)

            // Perform event coalescing/grouping by sensor or activity type.
            let _activities = await LAMP.Activity.allByParticipant(participant.id)
            let _state = { ...state,  
                activities: _activities, 
                activity_events: groupBy((await LAMP.ResultEvent.allByParticipant(participant.id))
                    .map(x => ({ ...x,
                        activity: _activities.find(y => x.activity === y.id || 
                                      (!!x.static_data.survey_name && 
                                          x.static_data.survey_name.toLowerCase() === y.name.toLowerCase()))
                    }))
                    .filter(x => !!x.activity ? !_hidden.includes(`${x.timestamp}/${x.activity.id}`) : true)
                    .sort((x, y) => x.timestamp - y.timestamp)
                    .map(x => ({ ...x,
                        activity: (x.activity || {name: ''}).name,
                        activity_spec: (x.activity || {spec: ''}).spec || ''
                    })), 'activity'),
                sensor_events: groupBy(await LAMP.SensorEvent.allByParticipant(participant.id), 'sensor'),
            }

            // Perform datetime coalescing to either days or weeks.
            _state.sensor_events['lamp.steps'] = 
                Object.values(groupBy(
                    ((_state.sensor_events || {})['lamp.steps'] || [])
                        .map(x => ({ ...x, timestamp: Math.round(x.timestamp / (24*60*60*1000)) /* days */ })), 
                'timestamp'))
                .map(x => x.reduce((a, b) => !!a.timestamp ? ({ ...a, 
                    data: { value: a.data.value + b.data.value, units: 'steps' } 
                }) : b, {}))
                .map(x => ({ ...x, timestamp: x.timestamp * (24*60*60*1000) /* days */}))

            // Perform count coalescing on processed events grouped by type.
            setState({ ..._state, 
                activity_counts: Object.assign({}, ...Object.entries((_state.activity_events || {})).map(([k, v]) => ({ [k]: v.length }))),
                sensor_counts: {
                    'Environmental Context': ((_state.sensor_events || {})['lamp.gps.contextual'] || []).length, 
                    'Step Count': ((_state.sensor_events || {})['lamp.steps'] || []).length
                }
            })
        })()
    }, [submission])

    // 
    useEffect(() => {
        if (activities.length === 0)
            return setSurvey()
        Promise.all(activities.map(x => LAMP.Type.getAttachment(x.id, 'lamp.dashboard.survey_description'))).then(res => {
            res = res.map(y => !!y.error ? undefined : y.data)
            setSurvey({
                name: activities.length === 1 ? activities[0].name : 'Multi-questionnaire',
                description: activities.length === 1 ? (!!res[0] ? res[0].description : undefined) : 'Please complete all sections below. Thank you.',
                sections: activities.map((x, idx) => ({
                    name: activities.length === 1 ? undefined : x.name,
                    description: activities.length === 1 ? undefined : (!!res[idx] ? res[idx].description : undefined),
                    questions: x.settings.map((y, idx2) => ({ ...y, 
                        description: !!res[idx] ? res[idx].settings[idx2] : undefined,
                        options: y.options === null ? null : y.options.map(z => ({ label: z, value: z }))
                    }))
                })),
                prefillData: activities[0].prefillData,
                prefillTimestamp: activities[0].prefillTimestamp
            })
        })
    }, [activities])

    //
    const hideEvent = async (timestamp, activity) => {
        let _hidden = await LAMP.Type.getAttachment(participant.id, 'lamp.dashboard.hidden_events')
        let _events = !!_hidden.error ? [] : _hidden.data
        if (hiddenEvents.includes(`${timestamp}/${activity}`))
            return
        let _setEvents = await LAMP.Type.setAttachment(participant.id, 'me', 'lamp.dashboard.hidden_events', 
                            [..._events, `${timestamp}/${activity}`])
        if (!!_setEvents.error)
            return
        //setHiddenEvents([..._events, `${timestamp}/${activity}`])
        setSubmission(x => x + 1)
    }

    // 
    const submitSurvey = (response, overwritingTimestamp) => {
        setSurvey()

        // 
        let events = response.map((x, idx) => ({
            timestamp: !!overwritingTimestamp ? overwritingTimestamp + 1000 /* 1sec */ : (new Date().getTime()),
            duration: 0,
            activity: activities[idx].id,
            static_data: { survey_name: activities[idx].name },
            temporal_events: (x || []).map(y => ({
                item: y !== undefined ? y.item : null,
                value: y !== undefined ? y.value : null,
                type: null,
                level: null,
                duration: 0,
            })),
        }))

        // 
        Promise.all(events.filter(x => x.temporal_events.length > 0).map(x => 
            LAMP.ResultEvent.create(participant.id, x).catch(e => console.dir(e))
        )).then(x => { setSubmission(x => x + 1) })

        // If a timestamp was provided to overwrite data, hide the original event too.
        if (!!overwritingTimestamp)
            hideEvent(overwritingTimestamp, activities[0 /* assumption made here */].id)
    }

    const earliestDate = () => {
        return (state.activities || [])
                    .filter(x => (state.selectedCharts || []).includes(x.name))
                    .map(x => ((state.activity_events || {})[x.name] || []))
                    .map(x => x.length === 0 ? 0 : x.slice(0, 1)[0].timestamp)
                    .sort((a, b) => a - b /* min */).slice(0, 1)
                    .map(x => x === 0 ? undefined : new Date(x))[0]
    }

    return (
        <React.Fragment>
            {false && <Box m="10%">
                <AvatarCircleGroup accounts={accounts()} />
            </Box>}
            <Box border={1} borderColor="grey.300" borderRadius={4} p={2} mx="10%">
                <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2">
                        Activity
                    </Typography>
                    <Box>
                        <Typography variant="inherit" color="inherit">
                            Show All
                        </Typography>
                        <Switch 
                            size="small"
                            checked={state.showAll} 
                            onChange={() => setState({ ...state, showAll: !state.showAll, selectedCharts: undefined })} 
                        />
                    </Box>
                </Box>
                <MultipleSelect 
                    selected={state.selectedCharts || []}
                    items={(state.activities || []).filter(x => x.spec === 'lamp.survey' || !!state.showAll).map(x => `${x.name}`)}
                    showZeroBadges={false}
                    badges={state.activity_counts}
                    onChange={x => setState({ ...state, selectedCharts: x })}
                />
                {LAMP.Auth.get_identity().name !== 'MAP NET' &&
                    <React.Fragment>
                        <Divider style={{ margin: '8px -16px 8px -16px' }} />
                        <Typography variant="subtitle2">
                            Sensor
                        </Typography>
                        <MultipleSelect 
                            selected={state.selectedPassive || []}
                            items={[`Environmental Context`, `Step Count`]}
                            showZeroBadges={false}
                            badges={state.sensor_counts}
                            onChange={x => setState({ ...state, selectedPassive: x })}
                        />
                    </React.Fragment>
                }

                {(LAMP.Auth.get_identity().name === 'Lamp Part 1 2 Survey'  || LAMP.Auth.get_identity().name === 'LAMP Part 1 One Survey') &&
                    <React.Fragment>
                        <Divider style={{ margin: '8px -16px 8px -16px' }} />
                        <Typography variant="subtitle2">
                            Automations
                        </Typography>
                        <MultipleSelect 
                            selected={state.selectedExperimental || []}
                            items={[`Symptom Network`, `Symptom Heatmap`]}
                            showZeroBadges={false}
                            badges={{'Symptom Network':2, 'Symptom Heatmap': 2}}
                            onChange={x => setState({ ...state, selectedExperimental: x })}
                        />
                    </React.Fragment>
                }
            </Box>
            {((state.selectedCharts || []).length + (state.selectedPassive || []).length) === 0 && 
                <Card style={{ marginTop: 16, marginBotton: 16, height: 96, backgroundColor: blue[700] }}>
                    <Typography variant="h6" style={{ width: '100%', textAlign: 'center', marginTop: 32, color: '#fff' }}>
                        No Activities are selected. Please select an Activity above to begin.
                    </Typography>
                </Card>
            }
            {(state.activities || []).filter(x => (state.selectedCharts || []).includes(x.name)).map(activity =>
                <Card key={activity.id} style={{ marginTop: 16, marginBotton: 16 }}>
                    <ActivityCard 
                        activity={activity} 
                        events={((state.activity_events || {})[activity.name] || [])} 
                        startDate={earliestDate()}
                        forceDefaultGrid={LAMP.Auth.get_identity().name === 'MAP NET'}
                        onEditAction={activity.spec !== 'lamp.survey' ? undefined : (data) => {
                            setActivities([{ ...activity, 
                                prefillData: [data.slice.map(({ item, value }) => ({ item, value }))], 
                                prefillTimestamp: data.x.getTime() /* post-increment later to avoid double-reporting events! */
                            }])
                        }}
                        onCopyAction={activity.spec !== 'lamp.survey' ? undefined : (data) => {
                            setActivities([{ ...activity, 
                                prefillData: [data.slice.map(({ item, value }) => ({ item, value }))]
                            }])
                        }}
                        onDeleteAction={(x) => hideEvent(x.x.getTime(), activity.id)}
                    />
                </Card>
            )}
            {!(state.selectedPassive || []).includes('Environmental Context') ? <React.Fragment /> : 
                <Card style={{ marginTop: 16, marginBotton: 16 }}>
                    <Typography component="h6" variant="h6" style={{ width: '100%', textAlign: 'center', margin: 16 }}>
                        Environmental Context
                    </Typography>
                    <Divider style={{ marginBottom: 16 }} />
                    <MultiPieChart data={
                        [
                            [

                                {
                                    label: 'Alone',
                                    value: ((state.sensor_events || {})['lamp.gps.contextual'] || [])
                                        .filter(x => x.data.context.social === 'alone')
                                        .length
                                },
                                {
                                    label: 'Friends',
                                    value: ((state.sensor_events || {})['lamp.gps.contextual'] || [])
                                        .filter(x => x.data.context.social === 'friends')
                                        .length
                                },
                                {
                                    label: 'Family',
                                    value: ((state.sensor_events || {})['lamp.gps.contextual'] || [])
                                        .filter(x => x.data.context.social === 'family')
                                        .length
                                },
                                {
                                    label: 'Peers',
                                    value: ((state.sensor_events || {})['lamp.gps.contextual'] || [])
                                        .filter(x => x.data.context.social === 'peers')
                                        .length
                                },
                                {
                                    label: 'Crowd',
                                    value: ((state.sensor_events || {})['lamp.gps.contextual'] || [])
                                        .filter(x => x.data.context.social === 'crowd')
                                        .length
                                },
                            ],
                            [
                                {
                                    label: 'Home',
                                    value: ((state.sensor_events || {})['lamp.gps.contextual'] || [])
                                        .filter(x => x.data.context.environment === 'home')
                                        .length
                                },
                                {
                                    label: 'School',
                                    value: ((state.sensor_events || {})['lamp.gps.contextual'] || [])
                                        .filter(x => x.data.context.environment === 'school')
                                        .length
                                },
                                {
                                    label: 'Work',
                                    value: ((state.sensor_events || {})['lamp.gps.contextual'] || [])
                                        .filter(x => x.data.context.environment === 'work')
                                        .length
                                },
                                {
                                    label: 'Hospital',
                                    value: ((state.sensor_events || {})['lamp.gps.contextual'] || [])
                                        .filter(x => x.data.context.environment === 'hospital')
                                        .length
                                },
                                {
                                    label: 'Outside',
                                    value: ((state.sensor_events || {})['lamp.gps.contextual'] || [])
                                        .filter(x => x.data.context.environment === 'outside')
                                        .length
                                },
                                {
                                    label: 'Shopping',
                                    value: ((state.sensor_events || {})['lamp.gps.contextual'] || [])
                                        .filter(x => x.data.context.environment === 'shopping')
                                        .length
                                },
                                {
                                    label: 'Transit',
                                    value: ((state.sensor_events || {})['lamp.gps.contextual'] || [])
                                        .filter(x => x.data.context.environment === 'transit')
                                        .length
                                },
                            ]
                        ]
                    } />
                </Card>
            }
            {!(state.selectedPassive || []).includes('Step Count') ? <React.Fragment /> : 
                <Card style={{ marginTop: 16, marginBotton: 16 }}>
                    <Typography component="h6" variant="h6" style={{ width: '100%', textAlign: 'center', margin: 16 }}>
                        Step Count
                    </Typography>
                    <Divider style={{ marginBottom: 16 }} />
                    <Sparkline 
                        minWidth={250}
                        minHeight={250}
                        XAxisLabel="Time"
                        YAxisLabel="Steps Taken"
                        color={blue[500]}
                        startDate={earliestDate()}
                        data={((state.sensor_events || {})['lamp.steps'] || [])
                              .map(d => ({ 
                                  x: new Date(parseInt(d.timestamp)), 
                                  y: d.data.value || 0
                              }))}
                        lineProps={{
                          dashArray: '3 1',
                          dashType: 'dotted',
                          cap: 'butt'
                        }} />
                </Card>
            }

            {!(state.selectedExperimental || []).includes('Symptom Network') ? <React.Fragment /> : 
                <Card style={{ marginTop: 16, marginBotton: 16 }}>
                    <Typography component="h6" variant="h6" style={{ width: '100%', textAlign: 'center', margin: 16 }}>
                        Symptom Network
                    </Typography>
                    <Divider style={{ marginBottom: 16 }} />
                    <Grid container spacing={40} justify={'center'}>                        
                        <Grid item>
                            <Typography component="h6" variant="h6" style={{ width: '100%', textAlign: 'center', margin: 16 }}>
                                Population Map
                            </Typography>
                            <img src={'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIKICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPgo8IS0tIEdlbmVyYXRlZCBieSBncmFwaHZpeiB2ZXJzaW9uIDIuMzguMCAoMjAxNDA0MTMuMjA0MSkKIC0tPgo8IS0tIFRpdGxlOiAlMyBQYWdlczogMSAtLT4KPHN2ZyB3aWR0aD0iMzkxcHQiIGhlaWdodD0iNDM1cHQiCiB2aWV3Qm94PSIwLjAwIDAuMDAgMzkxLjExIDQzNC44MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CjxnIGlkPSJncmFwaDAiIGNsYXNzPSJncmFwaCIgdHJhbnNmb3JtPSJzY2FsZSgxIDEpIHJvdGF0ZSgwKSB0cmFuc2xhdGUoNCA0MzAuOCkiPgo8dGl0bGU+JTM8L3RpdGxlPgo8cG9seWdvbiBmaWxsPSJ3aGl0ZSIgc3Ryb2tlPSJub25lIiBwb2ludHM9Ii00LDQgLTQsLTQzMC44IDM4Ny4xMSwtNDMwLjggMzg3LjExLDQgLTQsNCIvPgo8IS0tIE1vb2QgLS0+CjxnIGlkPSJub2RlMSIgY2xhc3M9Im5vZGUiPjx0aXRsZT5Nb29kPC90aXRsZT4KPGVsbGlwc2UgZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgY3g9IjIxOC4zOSIgY3k9Ii01MCIgcng9IjUwIiByeT0iNTAiLz4KPHRleHQgdGV4dC1hbmNob3I9Im1pZGRsZSIgeD0iMjE4LjM5IiB5PSItNDYuMyIgZm9udC1mYW1pbHk9IlRpbWVzLHNlcmlmIiBmb250LXNpemU9IjE0LjAwIj5Nb29kPC90ZXh0Pgo8L2c+CjwhLS0gQW54aWV0eSAtLT4KPGcgaWQ9Im5vZGUyIiBjbGFzcz0ibm9kZSI+PHRpdGxlPkFueGlldHk8L3RpdGxlPgo8ZWxsaXBzZSBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBjeD0iMzMxLjExIiBjeT0iLTIwNS4xNSIgcng9IjUyIiByeT0iNTIiLz4KPHRleHQgdGV4dC1hbmNob3I9Im1pZGRsZSIgeD0iMzMxLjExIiB5PSItMjAxLjQ1IiBmb250LWZhbWlseT0iVGltZXMsc2VyaWYiIGZvbnQtc2l6ZT0iMTQuMDAiPkFueGlldHk8L3RleHQ+CjwvZz4KPCEtLSBNb29kJiM0NTsmZ3Q7QW54aWV0eSAtLT4KPGcgaWQ9ImVkZ2UxIiBjbGFzcz0iZWRnZSI+PHRpdGxlPk1vb2QmIzQ1OyZndDtBbnhpZXR5PC90aXRsZT4KPHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSI0LjQ0NDQ0IiBkPSJNMjQyLjg1LC05My44ODlDMjU3LjE3LC0xMTUuMTEgMjc1LjUsLTE0MC40OSAyOTEuNzcsLTE2MS42NiIvPgo8cG9seWdvbiBmaWxsPSJibGFjayIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSI0LjQ0NDQ0IiBwb2ludHM9IjI5MC4xMjYsLTE2My4zNDggMjk1LjY0LC0xNjYuNjcgMjkzLjgxOSwtMTYwLjQ5NSAyOTAuMTI2LC0xNjMuMzQ4Ii8+CjwvZz4KPCEtLSBQc3ljaG9zaXMgLS0+CjxnIGlkPSJub2RlMyIgY2xhc3M9Im5vZGUiPjx0aXRsZT5Qc3ljaG9zaXM8L3RpdGxlPgo8ZWxsaXBzZSBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBjeD0iMjE4LjM5IiBjeT0iLTM2MC4zIiByeD0iNjYuNSIgcnk9IjY2LjUiLz4KPHRleHQgdGV4dC1hbmNob3I9Im1pZGRsZSIgeD0iMjE4LjM5IiB5PSItMzU2LjYiIGZvbnQtZmFtaWx5PSJUaW1lcyxzZXJpZiIgZm9udC1zaXplPSIxNC4wMCI+UHN5Y2hvc2lzPC90ZXh0Pgo8L2c+CjwhLS0gTW9vZCYjNDU7Jmd0O1BzeWNob3NpcyAtLT4KPGcgaWQ9ImVkZ2UyIiBjbGFzcz0iZWRnZSI+PHRpdGxlPk1vb2QmIzQ1OyZndDtQc3ljaG9zaXM8L3RpdGxlPgo8cGF0aCBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjQiIGQ9Ik0yMTMuMjcsLTk5Ljg1NUMyMTEuMzYsLTE1MC42IDIxMS4xMywtMjI5LjggMjEyLjU3LC0yODcuNTUiLz4KPHBvbHlnb24gZmlsbD0iYmxhY2siIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iNCIgcG9pbnRzPSIyMTAuNDc2LC0yODcuODI2IDIxMi43MywtMjkzLjc3IDIxNC42NzUsLTI4Ny43MTggMjEwLjQ3NiwtMjg3LjgyNiIvPgo8L2c+CjwhLS0gU2xlZXAgLS0+CjxnIGlkPSJub2RlNCIgY2xhc3M9Im5vZGUiPjx0aXRsZT5TbGVlcDwvdGl0bGU+CjxlbGxpcHNlIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIGN4PSIzNiIgY3k9Ii0zMDEuMDQiIHJ4PSIzNiIgcnk9IjM2Ii8+Cjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjM2IiB5PSItMjk3LjM0IiBmb250LWZhbWlseT0iVGltZXMsc2VyaWYiIGZvbnQtc2l6ZT0iMTQuMDAiPlNsZWVwPC90ZXh0Pgo8L2c+CjwhLS0gTW9vZCYjNDU7Jmd0O1NsZWVwIC0tPgo8ZyBpZD0iZWRnZTMiIGNsYXNzPSJlZGdlIj48dGl0bGU+TW9vZCYjNDU7Jmd0O1NsZWVwPC90aXRsZT4KPHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSI0LjE2NjY3IiBkPSJNMTg0Ljk1LC04Ny4zMjdDMTQ3LjU0LC0xMzQuOTMgODguMjk2LC0yMTYuNjUgNTYuOTEzLC0yNjQuMDgiLz4KPHBvbHlnb24gZmlsbD0iYmxhY2siIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iNC4xNjY2NyIgcG9pbnRzPSI1NS4wNjE2LC0yNjIuOTE0IDUzLjU5NiwtMjY5LjEzIDU4LjcxODQsLTI2NS4zMTYgNTUuMDYxNiwtMjYyLjkxNCIvPgo8L2c+CjwhLS0gU29jaWFsIC0tPgo8ZyBpZD0ibm9kZTUiIGNsYXNzPSJub2RlIj48dGl0bGU+U29jaWFsPC90aXRsZT4KPGVsbGlwc2UgZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgY3g9IjM2IiBjeT0iLTEwOS4yNiIgcng9IjIyIiByeT0iMjIiLz4KPHRleHQgdGV4dC1hbmNob3I9Im1pZGRsZSIgeD0iMzYiIHk9Ii0xMDUuNTYiIGZvbnQtZmFtaWx5PSJUaW1lcyxzZXJpZiIgZm9udC1zaXplPSIxNC4wMCI+U29jaWFsPC90ZXh0Pgo8L2c+CjwhLS0gTW9vZCYjNDU7Jmd0O1NvY2lhbCAtLT4KPGcgaWQ9ImVkZ2U0IiBjbGFzcz0iZWRnZSI+PHRpdGxlPk1vb2QmIzQ1OyZndDtTb2NpYWw8L3RpdGxlPgo8cGF0aCBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjMuMzMzMzMiIGQ9Ik0xNzAuNDcsLTY1LjU3QzEzNi4xOCwtNzYuNzEyIDkxLjI2MSwtOTEuMzA2IDYzLjAxMSwtMTAwLjQ5Ii8+Cjxwb2x5Z29uIGZpbGw9ImJsYWNrIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjMuMzMzMzMiIHBvaW50cz0iNjIuMzA1MywtOTguNTExMSA1Ny4yNDYsLTEwMi4zNiA2My42MDEyLC0xMDIuNTA2IDYyLjMwNTMsLTk4LjUxMTEiLz4KPC9nPgo8IS0tIEFueGlldHkmIzQ1OyZndDtNb29kIC0tPgo8ZyBpZD0iZWRnZTUiIGNsYXNzPSJlZGdlIj48dGl0bGU+QW54aWV0eSYjNDU7Jmd0O01vb2Q8L3RpdGxlPgo8cGF0aCBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjcuMTQyODYiIGQ9Ik0zMDUuNTIsLTE1OS41OUMyOTEsLTEzOC4xNSAyNzIuNjIsLTExMi43OCAyNTYuNDUsLTkxLjgyOSIvPgo8cG9seWdvbiBmaWxsPSJibGFjayIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSI3LjE0Mjg2IiBwb2ludHM9IjI1OS4yNTEsLTg5LjMyMTkgMjUyLjYxLC04Ni44ODEgMjUzLjMyNiwtOTMuOTIwMiAyNTkuMjUxLC04OS4zMjE5Ii8+CjwvZz4KPCEtLSBBbnhpZXR5JiM0NTsmZ3Q7UHN5Y2hvc2lzIC0tPgo8ZyBpZD0iZWRnZTYiIGNsYXNzPSJlZGdlIj48dGl0bGU+QW54aWV0eSYjNDU7Jmd0O1BzeWNob3NpczwvdGl0bGU+CjxwYXRoIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iNC4wODE2MyIgZD0iTTI5NS42OSwtMjQzLjU2QzI4Mi45OCwtMjU5LjkgMjY4LjY0LC0yNzkuMzYgMjU1Ljc3LC0yOTcuNjYiLz4KPHBvbHlnb24gZmlsbD0iYmxhY2siIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iNC4wODE2MyIgcG9pbnRzPSIyNTMuODY2LC0yOTYuNjQzIDI1Mi4xOSwtMzAyLjc5IDI1Ny4zODEsLTI5OS4wOTYgMjUzLjg2NiwtMjk2LjY0MyIvPgo8L2c+CjwhLS0gQW54aWV0eSYjNDU7Jmd0O1NsZWVwIC0tPgo8ZyBpZD0iZWRnZTciIGNsYXNzPSJlZGdlIj48dGl0bGU+QW54aWV0eSYjNDU7Jmd0O1NsZWVwPC90aXRsZT4KPHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSI1LjM2NTg1IiBkPSJNMjgwLjExLC0yMTYuMjZDMjIxLjc3LC0yMzIuOTEgMTI3LjUzLC0yNjMuNjYgNzQuODMsLTI4My4zNiIvPgo8cG9seWdvbiBmaWxsPSJibGFjayIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSI1LjM2NTg1IiBwb2ludHM9IjczLjU0NDMsLTI4MC44MzQgNjguOTI3LC0yODUuNTkgNzUuNTM1NCwtMjg2LjEwNSA3My41NDQzLC0yODAuODM0Ii8+CjwvZz4KPCEtLSBQc3ljaG9zaXMmIzQ1OyZndDtNb29kIC0tPgo8ZyBpZD0iZWRnZTgiIGNsYXNzPSJlZGdlIj48dGl0bGU+UHN5Y2hvc2lzJiM0NTsmZ3Q7TW9vZDwvdGl0bGU+CjxwYXRoIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iNS41MTcyNCIgZD0iTTIyNC4wNSwtMjkzLjczQzIyNS42LC0yMzcuOTUgMjI1LjUsLTE1OS4xOCAyMjMuNzQsLTEwNi40NCIvPgo8cG9seWdvbiBmaWxsPSJibGFjayIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSI1LjUxNzI0IiBwb2ludHM9IjIyNi42MjQsLTEwNi4wMyAyMjMuNTEsLTEwMC4xNCAyMjAuODM0LC0xMDYuMjQyIDIyNi42MjQsLTEwNi4wMyIvPgo8L2c+CjwhLS0gUHN5Y2hvc2lzJiM0NTsmZ3Q7QW54aWV0eSAtLT4KPGcgaWQ9ImVkZ2U5IiBjbGFzcz0iZWRnZSI+PHRpdGxlPlBzeWNob3NpcyYjNDU7Jmd0O0FueGlldHk8L3RpdGxlPgo8cGF0aCBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjMuOTAyNDQiIGQ9Ik0yNjIuNzIsLTMxMC4yN0MyNzUuODgsLTI5Mi45MiAyODkuOTMsLTI3My40NyAzMDEuODgsLTI1Ni4wNSIvPgo8cG9seWdvbiBmaWxsPSJibGFjayIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIzLjkwMjQ0IiBwb2ludHM9IjMwMy44NzYsLTI1Ni44NTEgMzA1LjUyLC0yNTAuNzEgMzAwLjQwNSwtMjU0LjQ4NSAzMDMuODc2LC0yNTYuODUxIi8+CjwvZz4KPCEtLSBQc3ljaG9zaXMmIzQ1OyZndDtTbGVlcCAtLT4KPGcgaWQ9ImVkZ2UxMCIgY2xhc3M9ImVkZ2UiPjx0aXRsZT5Qc3ljaG9zaXMmIzQ1OyZndDtTbGVlcDwvdGl0bGU+CjxwYXRoIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMy42NzM0NyIgZD0iTTE1Ny4zNiwtMzMzLjY4QzEzMS4xNSwtMzI0LjU3IDEwMS4xOSwtMzE1LjEgNzcuNTk1LC0zMDguNTciLz4KPHBvbHlnb24gZmlsbD0iYmxhY2siIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMy42NzM0NyIgcG9pbnRzPSI3OC4wODA0LC0zMDYuNTI2IDcxLjczOSwtMzA2Ljk3IDc2Ljk3MzMsLTMxMC41NzcgNzguMDgwNCwtMzA2LjUyNiIvPgo8L2c+CjwhLS0gU2xlZXAmIzQ1OyZndDtNb29kIC0tPgo8ZyBpZD0iZWRnZTExIiBjbGFzcz0iZWRnZSI+PHRpdGxlPlNsZWVwJiM0NTsmZ3Q7TW9vZDwvdGl0bGU+CjxwYXRoIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMy44NDYxNSIgZD0iTTYwLjk0LC0yNzQuNDFDOTQuNjg5LC0yMzIuNSAxNTQuNDYsLTE1MC42OCAxODkuOTIsLTk4LjI0OCIvPgo8cG9seWdvbiBmaWxsPSJibGFjayIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIzLjg0NjE1IiBwb2ludHM9IjE5MS42NjQsLTk5LjQxNzcgMTkzLjI3LC05My4yNjcgMTg4LjE3OSwtOTcuMDczOCAxOTEuNjY0LC05OS40MTc3Ii8+CjwvZz4KPCEtLSBTbGVlcCYjNDU7Jmd0O0FueGlldHkgLS0+CjxnIGlkPSJlZGdlMTIiIGNsYXNzPSJlZGdlIj48dGl0bGU+U2xlZXAmIzQ1OyZndDtBbnhpZXR5PC90aXRsZT4KPHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIzLjgwOTUyIiBkPSJNNzEuNTM1LC0yOTQuMjNDMTIyLjg0LC0yODAuMzUgMjE4LjAzLC0yNDkuNzQgMjc3Ljc5LC0yMjguMTUiLz4KPHBvbHlnb24gZmlsbD0iYmxhY2siIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMy44MDk1MiIgcG9pbnRzPSIyNzguNTM4LC0yMzAuMTEzIDI4My40NiwtMjI2LjA5IDI3Ny4xMDQsLTIyNi4xNjUgMjc4LjUzOCwtMjMwLjExMyIvPgo8L2c+CjwhLS0gU2xlZXAmIzQ1OyZndDtQc3ljaG9zaXMgLS0+CjxnIGlkPSJlZGdlMTMiIGNsYXNzPSJlZGdlIj48dGl0bGU+U2xlZXAmIzQ1OyZndDtQc3ljaG9zaXM8L3RpdGxlPgo8cGF0aCBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjMuNzgzNzgiIGQ9Ik02OC4yMTQsLTMxNy4xN0M5MC4xNDQsLTMyNS42IDEyMC4wMywtMzM1LjcyIDE0Ny4zOCwtMzQ0LjEzIi8+Cjxwb2x5Z29uIGZpbGw9ImJsYWNrIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjMuNzgzNzgiIHBvaW50cz0iMTQ2LjgxOCwtMzQ2LjE1NCAxNTMuMTcsLTM0NS45IDE0OC4wNDYsLTM0Mi4xMzggMTQ2LjgxOCwtMzQ2LjE1NCIvPgo8L2c+CjwhLS0gU2xlZXAmIzQ1OyZndDtTb2NpYWwgLS0+CjxnIGlkPSJlZGdlMTQiIGNsYXNzPSJlZGdlIj48dGl0bGU+U2xlZXAmIzQ1OyZndDtTb2NpYWw8L3RpdGxlPgo8cGF0aCBmaWxsPSJub25lIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjIuNzI3MjciIGQ9Ik00MS4zODgsLTI2NS40MkM0My4zNDksLTIyOC4zIDQzLjE5MywtMTcwLjkyIDQwLjkyLC0xMzcuMDIiLz4KPHBvbHlnb24gZmlsbD0iYmxhY2siIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMi43MjcyNyIgcG9pbnRzPSI0My4wMTAxLC0xMzYuODA4IDQwLjQ3MSwtMTMwLjk4IDM4LjgyMTcsLTEzNy4xMTkgNDMuMDEwMSwtMTM2LjgwOCIvPgo8L2c+CjwhLS0gU29jaWFsJiM0NTsmZ3Q7UHN5Y2hvc2lzIC0tPgo8ZyBpZD0iZWRnZTE1IiBjbGFzcz0iZWRnZSI+PHRpdGxlPlNvY2lhbCYjNDU7Jmd0O1BzeWNob3NpczwvdGl0bGU+CjxwYXRoIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMy4xMjUiIGQ9Ik00OS4xMTcsLTEyNy4zMkM3NS4yMDIsLTE2My4yMiAxMzQuNiwtMjQ0Ljk4IDE3NS42MSwtMzAxLjQyIi8+Cjxwb2x5Z29uIGZpbGw9ImJsYWNrIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjMuMTI1IiBwb2ludHM9IjE3NC4wNDUsLTMwMi44MzkgMTc5LjI3LC0zMDYuNDYgMTc3LjQ0NCwtMzAwLjM3MSAxNzQuMDQ1LC0zMDIuODM5Ii8+CjwvZz4KPCEtLSBTb2NpYWwmIzQ1OyZndDtTbGVlcCAtLT4KPGcgaWQ9ImVkZ2UxNiIgY2xhc3M9ImVkZ2UiPjx0aXRsZT5Tb2NpYWwmIzQ1OyZndDtTbGVlcDwvdGl0bGU+CjxwYXRoIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iNSIgZD0iTTMxLjUzNywtMTMwLjg5QzI4Ljk3OSwtMTYxLjg1IDI4LjU2NywtMjE5LjQzIDMwLjMwMSwtMjU4Ljk3Ii8+Cjxwb2x5Z29uIGZpbGw9ImJsYWNrIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjUiIHBvaW50cz0iMjcuNjg3OSwtMjU5LjI4MyAzMC41OTgsLTI2NS4xNSAzMi45MzE5LC0yNTkuMDMxIDI3LjY4NzksLTI1OS4yODMiLz4KPC9nPgo8L2c+Cjwvc3ZnPgo='} height="400" width="400" />                                        
                        </Grid>
      
                        <Grid item justify={'center'}>
                            <Typography component="h6" variant="h6" style={{ width: '100%', textAlign: 'center', margin: 16 }}>
                                Personal Map
                            </Typography>
                            <img src={'data:image/svg+xml;base64,' + visualizations.symptom_network} height="400" width="400" />                               
                        </Grid>
                    </Grid> 
                </Card>
            }

            {!(state.selectedExperimental || []).includes('Symptom Heatmap') ? <React.Fragment /> : 
                <Card style={{ marginTop: 16, marginBotton: 16 }}>
                    <Typography component="h6" variant="h6" style={{ width: '100%', textAlign: 'center', margin: 16 }}>
                        Symptom Heatmap
                    </Typography>
                    <Divider style={{ marginBottom: 16 }} />
                    <Grid container spacing={40} justify={'center'}>                        
                        <Grid item >
                            <Typography component="h6" variant="h6" style={{ width: '100%', textAlign: 'center', margin: 16 }}>
                                Population Map
                            </Typography>
                            <img src={'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIKICAiaHR0cDovL3d3dy53My5vcmcvR3JhcGhpY3MvU1ZHLzEuMS9EVEQvc3ZnMTEuZHRkIj4KPCEtLSBDcmVhdGVkIHdpdGggbWF0cGxvdGxpYiAoaHR0cHM6Ly9tYXRwbG90bGliLm9yZy8pIC0tPgo8c3ZnIGhlaWdodD0iMjg4cHQiIHZlcnNpb249IjEuMSIgdmlld0JveD0iMCAwIDQzMiAyODgiIHdpZHRoPSI0MzJwdCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CiA8ZGVmcz4KICA8c3R5bGUgdHlwZT0idGV4dC9jc3MiPgoqe3N0cm9rZS1saW5lY2FwOmJ1dHQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO30KICA8L3N0eWxlPgogPC9kZWZzPgogPGcgaWQ9ImZpZ3VyZV8xIj4KICA8ZyBpZD0icGF0Y2hfMSI+CiAgIDxwYXRoIGQ9Ik0gMCAyODggCkwgNDMyIDI4OCAKTCA0MzIgMCAKTCAwIDAgCnoKIiBzdHlsZT0iZmlsbDojZmZmZmZmOyIvPgogIDwvZz4KICA8ZyBpZD0iYXhlc18xIj4KICAgPGcgaWQ9InBhdGNoXzIiPgogICAgPHBhdGggZD0iTSA1NCAyNTIgCkwgMzIxLjg0IDI1MiAKTCAzMjEuODQgMzQuNTYgCkwgNTQgMzQuNTYgCnoKIiBzdHlsZT0iZmlsbDojZmZmZmZmOyIvPgogICA8L2c+CiAgIDxnIGlkPSJtYXRwbG90bGliLmF4aXNfMSI+CiAgICA8ZyBpZD0ieHRpY2tfMSI+CiAgICAgPGcgaWQ9InRleHRfMSI+CiAgICAgIDwhLS0gTW9vZCAtLT4KICAgICAgPGRlZnM+CiAgICAgICA8cGF0aCBkPSJNIDkuODEyNSA3Mi45MDYyNSAKTCAyNC41MTU2MjUgNzIuOTA2MjUgCkwgNDMuMTA5Mzc1IDIzLjI5Njg3NSAKTCA2MS44MTI1IDcyLjkwNjI1IApMIDc2LjUxNTYyNSA3Mi45MDYyNSAKTCA3Ni41MTU2MjUgMCAKTCA2Ni44OTA2MjUgMCAKTCA2Ni44OTA2MjUgNjQuMDE1NjI1IApMIDQ4LjA5Mzc1IDE0LjAxNTYyNSAKTCAzOC4xODc1IDE0LjAxNTYyNSAKTCAxOS4zOTA2MjUgNjQuMDE1NjI1IApMIDE5LjM5MDYyNSAwIApMIDkuODEyNSAwIAp6CiIgaWQ9IkRlamFWdVNhbnMtNzciLz4KICAgICAgIDxwYXRoIGQ9Ik0gMzAuNjA5Mzc1IDQ4LjM5MDYyNSAKUSAyMy4zOTA2MjUgNDguMzkwNjI1IDE5LjE4NzUgNDIuNzUgClEgMTQuOTg0Mzc1IDM3LjEwOTM3NSAxNC45ODQzNzUgMjcuMjk2ODc1IApRIDE0Ljk4NDM3NSAxNy40ODQzNzUgMTkuMTU2MjUgMTEuODQzNzUgClEgMjMuMzQzNzUgNi4yMDMxMjUgMzAuNjA5Mzc1IDYuMjAzMTI1IApRIDM3Ljc5Njg3NSA2LjIwMzEyNSA0MS45ODQzNzUgMTEuODU5Mzc1IApRIDQ2LjE4NzUgMTcuNTMxMjUgNDYuMTg3NSAyNy4yOTY4NzUgClEgNDYuMTg3NSAzNy4wMTU2MjUgNDEuOTg0Mzc1IDQyLjcwMzEyNSAKUSAzNy43OTY4NzUgNDguMzkwNjI1IDMwLjYwOTM3NSA0OC4zOTA2MjUgCnoKTSAzMC42MDkzNzUgNTYgClEgNDIuMzI4MTI1IDU2IDQ5LjAxNTYyNSA0OC4zNzUgClEgNTUuNzE4NzUgNDAuNzY1NjI1IDU1LjcxODc1IDI3LjI5Njg3NSAKUSA1NS43MTg3NSAxMy44NzUgNDkuMDE1NjI1IDYuMjE4NzUgClEgNDIuMzI4MTI1IC0xLjQyMTg3NSAzMC42MDkzNzUgLTEuNDIxODc1IApRIDE4Ljg0Mzc1IC0xLjQyMTg3NSAxMi4xNzE4NzUgNi4yMTg3NSAKUSA1LjUxNTYyNSAxMy44NzUgNS41MTU2MjUgMjcuMjk2ODc1IApRIDUuNTE1NjI1IDQwLjc2NTYyNSAxMi4xNzE4NzUgNDguMzc1IApRIDE4Ljg0Mzc1IDU2IDMwLjYwOTM3NSA1NiAKegoiIGlkPSJEZWphVnVTYW5zLTExMSIvPgogICAgICAgPHBhdGggZD0iTSA0NS40MDYyNSA0Ni4zOTA2MjUgCkwgNDUuNDA2MjUgNzUuOTg0Mzc1IApMIDU0LjM5MDYyNSA3NS45ODQzNzUgCkwgNTQuMzkwNjI1IDAgCkwgNDUuNDA2MjUgMCAKTCA0NS40MDYyNSA4LjIwMzEyNSAKUSA0Mi41NzgxMjUgMy4zMjgxMjUgMzguMjUgMC45NTMxMjUgClEgMzMuOTM3NSAtMS40MjE4NzUgMjcuODc1IC0xLjQyMTg3NSAKUSAxNy45Njg3NSAtMS40MjE4NzUgMTEuNzM0Mzc1IDYuNDg0Mzc1IApRIDUuNTE1NjI1IDE0LjQwNjI1IDUuNTE1NjI1IDI3LjI5Njg3NSAKUSA1LjUxNTYyNSA0MC4xODc1IDExLjczNDM3NSA0OC4wOTM3NSAKUSAxNy45Njg3NSA1NiAyNy44NzUgNTYgClEgMzMuOTM3NSA1NiAzOC4yNSA1My42MjUgClEgNDIuNTc4MTI1IDUxLjI2NTYyNSA0NS40MDYyNSA0Ni4zOTA2MjUgCnoKTSAxNC43OTY4NzUgMjcuMjk2ODc1IApRIDE0Ljc5Njg3NSAxNy4zOTA2MjUgMTguODc1IDExLjc1IApRIDIyLjk1MzEyNSA2LjEwOTM3NSAzMC4wNzgxMjUgNi4xMDkzNzUgClEgMzcuMjAzMTI1IDYuMTA5Mzc1IDQxLjI5Njg3NSAxMS43NSAKUSA0NS40MDYyNSAxNy4zOTA2MjUgNDUuNDA2MjUgMjcuMjk2ODc1IApRIDQ1LjQwNjI1IDM3LjIwMzEyNSA0MS4yOTY4NzUgNDIuODQzNzUgClEgMzcuMjAzMTI1IDQ4LjQ4NDM3NSAzMC4wNzgxMjUgNDguNDg0Mzc1IApRIDIyLjk1MzEyNSA0OC40ODQzNzUgMTguODc1IDQyLjg0Mzc1IApRIDE0Ljc5Njg3NSAzNy4yMDMxMjUgMTQuNzk2ODc1IDI3LjI5Njg3NSAKegoiIGlkPSJEZWphVnVTYW5zLTEwMCIvPgogICAgICA8L2RlZnM+CiAgICAgIDxnIHN0eWxlPSJmaWxsOiMyNjI2MjY7IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSg2Ny4xNzY5NjkgMjY2LjU5ODQzNylzY2FsZSgwLjEgLTAuMSkiPgogICAgICAgPHVzZSB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy03NyIvPgogICAgICAgPHVzZSB4PSI4Ni4yNzkyOTciIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExMSIvPgogICAgICAgPHVzZSB4PSIxNDcuNDYwOTM4IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTEiLz4KICAgICAgIDx1c2UgeD0iMjA4LjY0MjU3OCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTAwIi8+CiAgICAgIDwvZz4KICAgICA8L2c+CiAgICA8L2c+CiAgICA8ZyBpZD0ieHRpY2tfMiI+CiAgICAgPGcgaWQ9InRleHRfMiI+CiAgICAgIDwhLS0gQW54aWV0eSAtLT4KICAgICAgPGRlZnM+CiAgICAgICA8cGF0aCBkPSJNIDM0LjE4NzUgNjMuMTg3NSAKTCAyMC43OTY4NzUgMjYuOTA2MjUgCkwgNDcuNjA5Mzc1IDI2LjkwNjI1IAp6Ck0gMjguNjA5Mzc1IDcyLjkwNjI1IApMIDM5Ljc5Njg3NSA3Mi45MDYyNSAKTCA2Ny41NzgxMjUgMCAKTCA1Ny4zMjgxMjUgMCAKTCA1MC42ODc1IDE4LjcwMzEyNSAKTCAxNy44MjgxMjUgMTguNzAzMTI1IApMIDExLjE4NzUgMCAKTCAwLjc4MTI1IDAgCnoKIiBpZD0iRGVqYVZ1U2Fucy02NSIvPgogICAgICAgPHBhdGggZD0iTSA1NC44OTA2MjUgMzMuMDE1NjI1IApMIDU0Ljg5MDYyNSAwIApMIDQ1LjkwNjI1IDAgCkwgNDUuOTA2MjUgMzIuNzE4NzUgClEgNDUuOTA2MjUgNDAuNDg0Mzc1IDQyLjg3NSA0NC4zMjgxMjUgClEgMzkuODQzNzUgNDguMTg3NSAzMy43OTY4NzUgNDguMTg3NSAKUSAyNi41MTU2MjUgNDguMTg3NSAyMi4zMTI1IDQzLjU0Njg3NSAKUSAxOC4xMDkzNzUgMzguOTIxODc1IDE4LjEwOTM3NSAzMC45MDYyNSAKTCAxOC4xMDkzNzUgMCAKTCA5LjA3ODEyNSAwIApMIDkuMDc4MTI1IDU0LjY4NzUgCkwgMTguMTA5Mzc1IDU0LjY4NzUgCkwgMTguMTA5Mzc1IDQ2LjE4NzUgClEgMjEuMzQzNzUgNTEuMTI1IDI1LjcwMzEyNSA1My41NjI1IApRIDMwLjA3ODEyNSA1NiAzNS43OTY4NzUgNTYgClEgNDUuMjE4NzUgNTYgNTAuMDQ2ODc1IDUwLjE3MTg3NSAKUSA1NC44OTA2MjUgNDQuMzQzNzUgNTQuODkwNjI1IDMzLjAxNTYyNSAKegoiIGlkPSJEZWphVnVTYW5zLTExMCIvPgogICAgICAgPHBhdGggZD0iTSA1NC44OTA2MjUgNTQuNjg3NSAKTCAzNS4xMDkzNzUgMjguMDc4MTI1IApMIDU1LjkwNjI1IDAgCkwgNDUuMzEyNSAwIApMIDI5LjM5MDYyNSAyMS40ODQzNzUgCkwgMTMuNDg0Mzc1IDAgCkwgMi44NzUgMCAKTCAyNC4xMjUgMjguNjA5Mzc1IApMIDQuNjg3NSA1NC42ODc1IApMIDE1LjI4MTI1IDU0LjY4NzUgCkwgMjkuNzgxMjUgMzUuMjAzMTI1IApMIDQ0LjI4MTI1IDU0LjY4NzUgCnoKIiBpZD0iRGVqYVZ1U2Fucy0xMjAiLz4KICAgICAgIDxwYXRoIGQ9Ik0gOS40MjE4NzUgNTQuNjg3NSAKTCAxOC40MDYyNSA1NC42ODc1IApMIDE4LjQwNjI1IDAgCkwgOS40MjE4NzUgMCAKegpNIDkuNDIxODc1IDc1Ljk4NDM3NSAKTCAxOC40MDYyNSA3NS45ODQzNzUgCkwgMTguNDA2MjUgNjQuNTkzNzUgCkwgOS40MjE4NzUgNjQuNTkzNzUgCnoKIiBpZD0iRGVqYVZ1U2Fucy0xMDUiLz4KICAgICAgIDxwYXRoIGQ9Ik0gNTYuMjAzMTI1IDI5LjU5Mzc1IApMIDU2LjIwMzEyNSAyNS4yMDMxMjUgCkwgMTQuODkwNjI1IDI1LjIwMzEyNSAKUSAxNS40ODQzNzUgMTUuOTIxODc1IDIwLjQ4NDM3NSAxMS4wNjI1IApRIDI1LjQ4NDM3NSA2LjIwMzEyNSAzNC40MjE4NzUgNi4yMDMxMjUgClEgMzkuNTkzNzUgNi4yMDMxMjUgNDQuNDUzMTI1IDcuNDY4NzUgClEgNDkuMzEyNSA4LjczNDM3NSA1NC4xMDkzNzUgMTEuMjgxMjUgCkwgNTQuMTA5Mzc1IDIuNzgxMjUgClEgNDkuMjY1NjI1IDAuNzM0Mzc1IDQ0LjE4NzUgLTAuMzQzNzUgClEgMzkuMTA5Mzc1IC0xLjQyMTg3NSAzMy44OTA2MjUgLTEuNDIxODc1IApRIDIwLjc5Njg3NSAtMS40MjE4NzUgMTMuMTU2MjUgNi4xODc1IApRIDUuNTE1NjI1IDEzLjgxMjUgNS41MTU2MjUgMjYuODEyNSAKUSA1LjUxNTYyNSA0MC4yMzQzNzUgMTIuNzY1NjI1IDQ4LjEwOTM3NSAKUSAyMC4wMTU2MjUgNTYgMzIuMzI4MTI1IDU2IApRIDQzLjM1OTM3NSA1NiA0OS43ODEyNSA0OC44OTA2MjUgClEgNTYuMjAzMTI1IDQxLjc5Njg3NSA1Ni4yMDMxMjUgMjkuNTkzNzUgCnoKTSA0Ny4yMTg3NSAzMi4yMzQzNzUgClEgNDcuMTI1IDM5LjU5Mzc1IDQzLjA5Mzc1IDQzLjk4NDM3NSAKUSAzOS4wNjI1IDQ4LjM5MDYyNSAzMi40MjE4NzUgNDguMzkwNjI1IApRIDI0LjkwNjI1IDQ4LjM5MDYyNSAyMC4zOTA2MjUgNDQuMTQwNjI1IApRIDE1Ljg3NSAzOS44OTA2MjUgMTUuMTg3NSAzMi4xNzE4NzUgCnoKIiBpZD0iRGVqYVZ1U2Fucy0xMDEiLz4KICAgICAgIDxwYXRoIGQ9Ik0gMTguMzEyNSA3MC4yMTg3NSAKTCAxOC4zMTI1IDU0LjY4NzUgCkwgMzYuODEyNSA1NC42ODc1IApMIDM2LjgxMjUgNDcuNzAzMTI1IApMIDE4LjMxMjUgNDcuNzAzMTI1IApMIDE4LjMxMjUgMTguMDE1NjI1IApRIDE4LjMxMjUgMTEuMzI4MTI1IDIwLjE0MDYyNSA5LjQyMTg3NSAKUSAyMS45Njg3NSA3LjUxNTYyNSAyNy41OTM3NSA3LjUxNTYyNSAKTCAzNi44MTI1IDcuNTE1NjI1IApMIDM2LjgxMjUgMCAKTCAyNy41OTM3NSAwIApRIDE3LjE4NzUgMCAxMy4yMzQzNzUgMy44NzUgClEgOS4yODEyNSA3Ljc2NTYyNSA5LjI4MTI1IDE4LjAxNTYyNSAKTCA5LjI4MTI1IDQ3LjcwMzEyNSAKTCAyLjY4NzUgNDcuNzAzMTI1IApMIDIuNjg3NSA1NC42ODc1IApMIDkuMjgxMjUgNTQuNjg3NSAKTCA5LjI4MTI1IDcwLjIxODc1IAp6CiIgaWQ9IkRlamFWdVNhbnMtMTE2Ii8+CiAgICAgICA8cGF0aCBkPSJNIDMyLjE3MTg3NSAtNS4wNzgxMjUgClEgMjguMzc1IC0xNC44NDM3NSAyNC43NSAtMTcuODEyNSAKUSAyMS4xNDA2MjUgLTIwLjc5Njg3NSAxNS4wOTM3NSAtMjAuNzk2ODc1IApMIDcuOTA2MjUgLTIwLjc5Njg3NSAKTCA3LjkwNjI1IC0xMy4yODEyNSAKTCAxMy4xODc1IC0xMy4yODEyNSAKUSAxNi44OTA2MjUgLTEzLjI4MTI1IDE4LjkzNzUgLTExLjUxNTYyNSAKUSAyMSAtOS43NjU2MjUgMjMuNDg0Mzc1IC0zLjIxODc1IApMIDI1LjA5Mzc1IDAuODc1IApMIDIuOTg0Mzc1IDU0LjY4NzUgCkwgMTIuNSA1NC42ODc1IApMIDI5LjU5Mzc1IDExLjkyMTg3NSAKTCA0Ni42ODc1IDU0LjY4NzUgCkwgNTYuMjAzMTI1IDU0LjY4NzUgCnoKIiBpZD0iRGVqYVZ1U2Fucy0xMjEiLz4KICAgICAgPC9kZWZzPgogICAgICA8ZyBzdHlsZT0iZmlsbDojMjYyNjI2OyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTE1LjQxODQwNiAyNjYuNTk4NDM3KXNjYWxlKDAuMSAtMC4xKSI+CiAgICAgICA8dXNlIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTY1Ii8+CiAgICAgICA8dXNlIHg9IjY4LjQwODIwMyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTEwIi8+CiAgICAgICA8dXNlIHg9IjEzMS43ODcxMDkiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTEyMCIvPgogICAgICAgPHVzZSB4PSIxOTAuOTY2Nzk3IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDUiLz4KICAgICAgIDx1c2UgeD0iMjE4Ljc1IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDEiLz4KICAgICAgIDx1c2UgeD0iMjgwLjI3MzQzOCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTE2Ii8+CiAgICAgICA8dXNlIHg9IjMxOS40ODI0MjIiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTEyMSIvPgogICAgICA8L2c+CiAgICAgPC9nPgogICAgPC9nPgogICAgPGcgaWQ9Inh0aWNrXzMiPgogICAgIDxnIGlkPSJ0ZXh0XzMiPgogICAgICA8IS0tIFBzeWNob3NpcyAtLT4KICAgICAgPGRlZnM+CiAgICAgICA8cGF0aCBkPSJNIDE5LjY3MTg3NSA2NC43OTY4NzUgCkwgMTkuNjcxODc1IDM3LjQwNjI1IApMIDMyLjA3ODEyNSAzNy40MDYyNSAKUSAzOC45Njg3NSAzNy40MDYyNSA0Mi43MTg3NSA0MC45Njg3NSAKUSA0Ni40ODQzNzUgNDQuNTMxMjUgNDYuNDg0Mzc1IDUxLjEyNSAKUSA0Ni40ODQzNzUgNTcuNjcxODc1IDQyLjcxODc1IDYxLjIzNDM3NSAKUSAzOC45Njg3NSA2NC43OTY4NzUgMzIuMDc4MTI1IDY0Ljc5Njg3NSAKegpNIDkuODEyNSA3Mi45MDYyNSAKTCAzMi4wNzgxMjUgNzIuOTA2MjUgClEgNDQuMzQzNzUgNzIuOTA2MjUgNTAuNjA5Mzc1IDY3LjM1OTM3NSAKUSA1Ni44OTA2MjUgNjEuODEyNSA1Ni44OTA2MjUgNTEuMTI1IApRIDU2Ljg5MDYyNSA0MC4zMjgxMjUgNTAuNjA5Mzc1IDM0LjgxMjUgClEgNDQuMzQzNzUgMjkuMjk2ODc1IDMyLjA3ODEyNSAyOS4yOTY4NzUgCkwgMTkuNjcxODc1IDI5LjI5Njg3NSAKTCAxOS42NzE4NzUgMCAKTCA5LjgxMjUgMCAKegoiIGlkPSJEZWphVnVTYW5zLTgwIi8+CiAgICAgICA8cGF0aCBkPSJNIDQ0LjI4MTI1IDUzLjA3ODEyNSAKTCA0NC4yODEyNSA0NC41NzgxMjUgClEgNDAuNDg0Mzc1IDQ2LjUzMTI1IDM2LjM3NSA0Ny41IApRIDMyLjI4MTI1IDQ4LjQ4NDM3NSAyNy44NzUgNDguNDg0Mzc1IApRIDIxLjE4NzUgNDguNDg0Mzc1IDE3Ljg0Mzc1IDQ2LjQzNzUgClEgMTQuNSA0NC4zOTA2MjUgMTQuNSA0MC4yODEyNSAKUSAxNC41IDM3LjE1NjI1IDE2Ljg5MDYyNSAzNS4zNzUgClEgMTkuMjgxMjUgMzMuNTkzNzUgMjYuNTE1NjI1IDMxLjk4NDM3NSAKTCAyOS41OTM3NSAzMS4yOTY4NzUgClEgMzkuMTU2MjUgMjkuMjUgNDMuMTg3NSAyNS41MTU2MjUgClEgNDcuMjE4NzUgMjEuNzgxMjUgNDcuMjE4NzUgMTUuMDkzNzUgClEgNDcuMjE4NzUgNy40Njg3NSA0MS4xODc1IDMuMDE1NjI1IApRIDM1LjE1NjI1IC0xLjQyMTg3NSAyNC42MDkzNzUgLTEuNDIxODc1IApRIDIwLjIxODc1IC0xLjQyMTg3NSAxNS40NTMxMjUgLTAuNTYyNSAKUSAxMC42ODc1IDAuMjk2ODc1IDUuNDIxODc1IDIgCkwgNS40MjE4NzUgMTEuMjgxMjUgClEgMTAuNDA2MjUgOC42ODc1IDE1LjIzNDM3NSA3LjM5MDYyNSAKUSAyMC4wNjI1IDYuMTA5Mzc1IDI0LjgxMjUgNi4xMDkzNzUgClEgMzEuMTU2MjUgNi4xMDkzNzUgMzQuNTYyNSA4LjI4MTI1IApRIDM3Ljk4NDM3NSAxMC40NTMxMjUgMzcuOTg0Mzc1IDE0LjQwNjI1IApRIDM3Ljk4NDM3NSAxOC4wNjI1IDM1LjUxNTYyNSAyMC4wMTU2MjUgClEgMzMuMDYyNSAyMS45Njg3NSAyNC43MDMxMjUgMjMuNzgxMjUgCkwgMjEuNTc4MTI1IDI0LjUxNTYyNSAKUSAxMy4yMzQzNzUgMjYuMjY1NjI1IDkuNTE1NjI1IDI5LjkwNjI1IApRIDUuODEyNSAzMy41NDY4NzUgNS44MTI1IDM5Ljg5MDYyNSAKUSA1LjgxMjUgNDcuNjA5Mzc1IDExLjI4MTI1IDUxLjc5Njg3NSAKUSAxNi43NSA1NiAyNi44MTI1IDU2IApRIDMxLjc4MTI1IDU2IDM2LjE3MTg3NSA1NS4yNjU2MjUgClEgNDAuNTc4MTI1IDU0LjU0Njg3NSA0NC4yODEyNSA1My4wNzgxMjUgCnoKIiBpZD0iRGVqYVZ1U2Fucy0xMTUiLz4KICAgICAgIDxwYXRoIGQ9Ik0gNDguNzgxMjUgNTIuNTkzNzUgCkwgNDguNzgxMjUgNDQuMTg3NSAKUSA0NC45Njg3NSA0Ni4yOTY4NzUgNDEuMTQwNjI1IDQ3LjM0Mzc1IApRIDM3LjMxMjUgNDguMzkwNjI1IDMzLjQwNjI1IDQ4LjM5MDYyNSAKUSAyNC42NTYyNSA0OC4zOTA2MjUgMTkuODEyNSA0Mi44NDM3NSAKUSAxNC45ODQzNzUgMzcuMzEyNSAxNC45ODQzNzUgMjcuMjk2ODc1IApRIDE0Ljk4NDM3NSAxNy4yODEyNSAxOS44MTI1IDExLjczNDM3NSAKUSAyNC42NTYyNSA2LjIwMzEyNSAzMy40MDYyNSA2LjIwMzEyNSAKUSAzNy4zMTI1IDYuMjAzMTI1IDQxLjE0MDYyNSA3LjI1IApRIDQ0Ljk2ODc1IDguMjk2ODc1IDQ4Ljc4MTI1IDEwLjQwNjI1IApMIDQ4Ljc4MTI1IDIuMDkzNzUgClEgNDUuMDE1NjI1IDAuMzQzNzUgNDAuOTg0Mzc1IC0wLjUzMTI1IApRIDM2Ljk2ODc1IC0xLjQyMTg3NSAzMi40MjE4NzUgLTEuNDIxODc1IApRIDIwLjA2MjUgLTEuNDIxODc1IDEyLjc4MTI1IDYuMzQzNzUgClEgNS41MTU2MjUgMTQuMTA5Mzc1IDUuNTE1NjI1IDI3LjI5Njg3NSAKUSA1LjUxNTYyNSA0MC42NzE4NzUgMTIuODU5Mzc1IDQ4LjMyODEyNSAKUSAyMC4yMTg3NSA1NiAzMy4wMTU2MjUgNTYgClEgMzcuMTU2MjUgNTYgNDEuMTA5Mzc1IDU1LjE0MDYyNSAKUSA0NS4wNjI1IDU0LjI5Njg3NSA0OC43ODEyNSA1Mi41OTM3NSAKegoiIGlkPSJEZWphVnVTYW5zLTk5Ii8+CiAgICAgICA8cGF0aCBkPSJNIDU0Ljg5MDYyNSAzMy4wMTU2MjUgCkwgNTQuODkwNjI1IDAgCkwgNDUuOTA2MjUgMCAKTCA0NS45MDYyNSAzMi43MTg3NSAKUSA0NS45MDYyNSA0MC40ODQzNzUgNDIuODc1IDQ0LjMyODEyNSAKUSAzOS44NDM3NSA0OC4xODc1IDMzLjc5Njg3NSA0OC4xODc1IApRIDI2LjUxNTYyNSA0OC4xODc1IDIyLjMxMjUgNDMuNTQ2ODc1IApRIDE4LjEwOTM3NSAzOC45MjE4NzUgMTguMTA5Mzc1IDMwLjkwNjI1IApMIDE4LjEwOTM3NSAwIApMIDkuMDc4MTI1IDAgCkwgOS4wNzgxMjUgNzUuOTg0Mzc1IApMIDE4LjEwOTM3NSA3NS45ODQzNzUgCkwgMTguMTA5Mzc1IDQ2LjE4NzUgClEgMjEuMzQzNzUgNTEuMTI1IDI1LjcwMzEyNSA1My41NjI1IApRIDMwLjA3ODEyNSA1NiAzNS43OTY4NzUgNTYgClEgNDUuMjE4NzUgNTYgNTAuMDQ2ODc1IDUwLjE3MTg3NSAKUSA1NC44OTA2MjUgNDQuMzQzNzUgNTQuODkwNjI1IDMzLjAxNTYyNSAKegoiIGlkPSJEZWphVnVTYW5zLTEwNCIvPgogICAgICA8L2RlZnM+CiAgICAgIDxnIHN0eWxlPSJmaWxsOiMyNjI2MjY7IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxNjMuNzY2MDk0IDI2Ni41OTg0Mzcpc2NhbGUoMC4xIC0wLjEpIj4KICAgICAgIDx1c2UgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtODAiLz4KICAgICAgIDx1c2UgeD0iNjAuMjg3MTA5IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTUiLz4KICAgICAgIDx1c2UgeD0iMTEyLjM4NjcxOSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTIxIi8+CiAgICAgICA8dXNlIHg9IjE3MS41NjY0MDYiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTk5Ii8+CiAgICAgICA8dXNlIHg9IjIyNi41NDY4NzUiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTEwNCIvPgogICAgICAgPHVzZSB4PSIyODkuOTI1NzgxIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTEiLz4KICAgICAgIDx1c2UgeD0iMzUxLjEwNzQyMiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTE1Ii8+CiAgICAgICA8dXNlIHg9IjQwMy4yMDcwMzEiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTEwNSIvPgogICAgICAgPHVzZSB4PSI0MzAuOTkwMjM0IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTUiLz4KICAgICAgPC9nPgogICAgIDwvZz4KICAgIDwvZz4KICAgIDxnIGlkPSJ4dGlja180Ij4KICAgICA8ZyBpZD0idGV4dF80Ij4KICAgICAgPCEtLSBTbGVlcCAtLT4KICAgICAgPGRlZnM+CiAgICAgICA8cGF0aCBkPSJNIDUzLjUxNTYyNSA3MC41MTU2MjUgCkwgNTMuNTE1NjI1IDYwLjg5MDYyNSAKUSA0Ny45MDYyNSA2My41NzgxMjUgNDIuOTIxODc1IDY0Ljg5MDYyNSAKUSAzNy45Mzc1IDY2LjIxODc1IDMzLjI5Njg3NSA2Ni4yMTg3NSAKUSAyNS4yNSA2Ni4yMTg3NSAyMC44NzUgNjMuMDkzNzUgClEgMTYuNSA1OS45Njg3NSAxNi41IDU0LjIwMzEyNSAKUSAxNi41IDQ5LjM1OTM3NSAxOS40MDYyNSA0Ni44OTA2MjUgClEgMjIuMzEyNSA0NC40Mzc1IDMwLjQyMTg3NSA0Mi45MjE4NzUgCkwgMzYuMzc1IDQxLjcwMzEyNSAKUSA0Ny40MDYyNSAzOS41OTM3NSA1Mi42NTYyNSAzNC4yOTY4NzUgClEgNTcuOTA2MjUgMjkgNTcuOTA2MjUgMjAuMTI1IApRIDU3LjkwNjI1IDkuNTE1NjI1IDUwLjc5Njg3NSA0LjA0Njg3NSAKUSA0My43MDMxMjUgLTEuNDIxODc1IDI5Ljk4NDM3NSAtMS40MjE4NzUgClEgMjQuODEyNSAtMS40MjE4NzUgMTguOTY4NzUgLTAuMjUgClEgMTMuMTQwNjI1IDAuOTIxODc1IDYuODkwNjI1IDMuMjE4NzUgCkwgNi44OTA2MjUgMTMuMzc1IApRIDEyLjg5MDYyNSAxMC4wMTU2MjUgMTguNjU2MjUgOC4yOTY4NzUgClEgMjQuNDIxODc1IDYuNTkzNzUgMjkuOTg0Mzc1IDYuNTkzNzUgClEgMzguNDIxODc1IDYuNTkzNzUgNDMuMDE1NjI1IDkuOTA2MjUgClEgNDcuNjA5Mzc1IDEzLjIzNDM3NSA0Ny42MDkzNzUgMTkuMzkwNjI1IApRIDQ3LjYwOTM3NSAyNC43NSA0NC4zMTI1IDI3Ljc4MTI1IApRIDQxLjAxNTYyNSAzMC44MTI1IDMzLjUgMzIuMzI4MTI1IApMIDI3LjQ4NDM3NSAzMy41IApRIDE2LjQ1MzEyNSAzNS42ODc1IDExLjUxNTYyNSA0MC4zNzUgClEgNi41OTM3NSA0NS4wNjI1IDYuNTkzNzUgNTMuNDIxODc1IApRIDYuNTkzNzUgNjMuMDkzNzUgMTMuNDA2MjUgNjguNjU2MjUgClEgMjAuMjE4NzUgNzQuMjE4NzUgMzIuMTcxODc1IDc0LjIxODc1IApRIDM3LjMxMjUgNzQuMjE4NzUgNDIuNjI1IDczLjI4MTI1IApRIDQ3Ljk1MzEyNSA3Mi4zNTkzNzUgNTMuNTE1NjI1IDcwLjUxNTYyNSAKegoiIGlkPSJEZWphVnVTYW5zLTgzIi8+CiAgICAgICA8cGF0aCBkPSJNIDkuNDIxODc1IDc1Ljk4NDM3NSAKTCAxOC40MDYyNSA3NS45ODQzNzUgCkwgMTguNDA2MjUgMCAKTCA5LjQyMTg3NSAwIAp6CiIgaWQ9IkRlamFWdVNhbnMtMTA4Ii8+CiAgICAgICA8cGF0aCBkPSJNIDE4LjEwOTM3NSA4LjIwMzEyNSAKTCAxOC4xMDkzNzUgLTIwLjc5Njg3NSAKTCA5LjA3ODEyNSAtMjAuNzk2ODc1IApMIDkuMDc4MTI1IDU0LjY4NzUgCkwgMTguMTA5Mzc1IDU0LjY4NzUgCkwgMTguMTA5Mzc1IDQ2LjM5MDYyNSAKUSAyMC45NTMxMjUgNTEuMjY1NjI1IDI1LjI2NTYyNSA1My42MjUgClEgMjkuNTkzNzUgNTYgMzUuNTkzNzUgNTYgClEgNDUuNTYyNSA1NiA1MS43ODEyNSA0OC4wOTM3NSAKUSA1OC4wMTU2MjUgNDAuMTg3NSA1OC4wMTU2MjUgMjcuMjk2ODc1IApRIDU4LjAxNTYyNSAxNC40MDYyNSA1MS43ODEyNSA2LjQ4NDM3NSAKUSA0NS41NjI1IC0xLjQyMTg3NSAzNS41OTM3NSAtMS40MjE4NzUgClEgMjkuNTkzNzUgLTEuNDIxODc1IDI1LjI2NTYyNSAwLjk1MzEyNSAKUSAyMC45NTMxMjUgMy4zMjgxMjUgMTguMTA5Mzc1IDguMjAzMTI1IAp6Ck0gNDguNjg3NSAyNy4yOTY4NzUgClEgNDguNjg3NSAzNy4yMDMxMjUgNDQuNjA5Mzc1IDQyLjg0Mzc1IApRIDQwLjUzMTI1IDQ4LjQ4NDM3NSAzMy40MDYyNSA0OC40ODQzNzUgClEgMjYuMjY1NjI1IDQ4LjQ4NDM3NSAyMi4xODc1IDQyLjg0Mzc1IApRIDE4LjEwOTM3NSAzNy4yMDMxMjUgMTguMTA5Mzc1IDI3LjI5Njg3NSAKUSAxOC4xMDkzNzUgMTcuMzkwNjI1IDIyLjE4NzUgMTEuNzUgClEgMjYuMjY1NjI1IDYuMTA5Mzc1IDMzLjQwNjI1IDYuMTA5Mzc1IApRIDQwLjUzMTI1IDYuMTA5Mzc1IDQ0LjYwOTM3NSAxMS43NSAKUSA0OC42ODc1IDE3LjM5MDYyNSA0OC42ODc1IDI3LjI5Njg3NSAKegoiIGlkPSJEZWphVnVTYW5zLTExMiIvPgogICAgICA8L2RlZnM+CiAgICAgIDxnIHN0eWxlPSJmaWxsOiMyNjI2MjY7IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgyMjcuNTk3Mzc1IDI2Ni41OTg0Mzcpc2NhbGUoMC4xIC0wLjEpIj4KICAgICAgIDx1c2UgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtODMiLz4KICAgICAgIDx1c2UgeD0iNjMuNDc2NTYyIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDgiLz4KICAgICAgIDx1c2UgeD0iOTEuMjU5NzY2IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDEiLz4KICAgICAgIDx1c2UgeD0iMTUyLjc4MzIwMyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTAxIi8+CiAgICAgICA8dXNlIHg9IjIxNC4zMDY2NDEiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExMiIvPgogICAgICA8L2c+CiAgICAgPC9nPgogICAgPC9nPgogICAgPGcgaWQ9Inh0aWNrXzUiPgogICAgIDxnIGlkPSJ0ZXh0XzUiPgogICAgICA8IS0tIFNvY2lhbCAtLT4KICAgICAgPGRlZnM+CiAgICAgICA8cGF0aCBkPSJNIDM0LjI4MTI1IDI3LjQ4NDM3NSAKUSAyMy4zOTA2MjUgMjcuNDg0Mzc1IDE5LjE4NzUgMjUgClEgMTQuOTg0Mzc1IDIyLjUxNTYyNSAxNC45ODQzNzUgMTYuNSAKUSAxNC45ODQzNzUgMTEuNzE4NzUgMTguMTQwNjI1IDguOTA2MjUgClEgMjEuMjk2ODc1IDYuMTA5Mzc1IDI2LjcwMzEyNSA2LjEwOTM3NSAKUSAzNC4xODc1IDYuMTA5Mzc1IDM4LjcwMzEyNSAxMS40MDYyNSAKUSA0My4yMTg3NSAxNi43MDMxMjUgNDMuMjE4NzUgMjUuNDg0Mzc1IApMIDQzLjIxODc1IDI3LjQ4NDM3NSAKegpNIDUyLjIwMzEyNSAzMS4yMDMxMjUgCkwgNTIuMjAzMTI1IDAgCkwgNDMuMjE4NzUgMCAKTCA0My4yMTg3NSA4LjI5Njg3NSAKUSA0MC4xNDA2MjUgMy4zMjgxMjUgMzUuNTQ2ODc1IDAuOTUzMTI1IApRIDMwLjk1MzEyNSAtMS40MjE4NzUgMjQuMzEyNSAtMS40MjE4NzUgClEgMTUuOTIxODc1IC0xLjQyMTg3NSAxMC45NTMxMjUgMy4yOTY4NzUgClEgNiA4LjAxNTYyNSA2IDE1LjkyMTg3NSAKUSA2IDI1LjE0MDYyNSAxMi4xNzE4NzUgMjkuODI4MTI1IApRIDE4LjM1OTM3NSAzNC41MTU2MjUgMzAuNjA5Mzc1IDM0LjUxNTYyNSAKTCA0My4yMTg3NSAzNC41MTU2MjUgCkwgNDMuMjE4NzUgMzUuNDA2MjUgClEgNDMuMjE4NzUgNDEuNjA5Mzc1IDM5LjE0MDYyNSA0NSAKUSAzNS4wNjI1IDQ4LjM5MDYyNSAyNy42ODc1IDQ4LjM5MDYyNSAKUSAyMyA0OC4zOTA2MjUgMTguNTQ2ODc1IDQ3LjI2NTYyNSAKUSAxNC4xMDkzNzUgNDYuMTQwNjI1IDEwLjAxNTYyNSA0My44OTA2MjUgCkwgMTAuMDE1NjI1IDUyLjIwMzEyNSAKUSAxNC45Mzc1IDU0LjEwOTM3NSAxOS41NzgxMjUgNTUuMDQ2ODc1IApRIDI0LjIxODc1IDU2IDI4LjYwOTM3NSA1NiAKUSA0MC40ODQzNzUgNTYgNDYuMzQzNzUgNDkuODQzNzUgClEgNTIuMjAzMTI1IDQzLjcwMzEyNSA1Mi4yMDMxMjUgMzEuMjAzMTI1IAp6CiIgaWQ9IkRlamFWdVNhbnMtOTciLz4KICAgICAgPC9kZWZzPgogICAgICA8ZyBzdHlsZT0iZmlsbDojMjYyNjI2OyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjgwLjIzMSAyNjYuNTk4NDM3KXNjYWxlKDAuMSAtMC4xKSI+CiAgICAgICA8dXNlIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTgzIi8+CiAgICAgICA8dXNlIHg9IjYzLjQ3NjU2MiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTExIi8+CiAgICAgICA8dXNlIHg9IjEyNC42NTgyMDMiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTk5Ii8+CiAgICAgICA8dXNlIHg9IjE3OS42Mzg2NzIiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTEwNSIvPgogICAgICAgPHVzZSB4PSIyMDcuNDIxODc1IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy05NyIvPgogICAgICAgPHVzZSB4PSIyNjguNzAxMTcyIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDgiLz4KICAgICAgPC9nPgogICAgIDwvZz4KICAgIDwvZz4KICAgIDxnIGlkPSJ0ZXh0XzYiPgogICAgIDwhLS0gSW5kdWNlZCBEb21haW4gKHRpbWUgPSB0KzEpIC0tPgogICAgIDxkZWZzPgogICAgICA8cGF0aCBkPSJNIDkuODEyNSA3Mi45MDYyNSAKTCAxOS42NzE4NzUgNzIuOTA2MjUgCkwgMTkuNjcxODc1IDAgCkwgOS44MTI1IDAgCnoKIiBpZD0iRGVqYVZ1U2Fucy03MyIvPgogICAgICA8cGF0aCBkPSJNIDguNSAyMS41NzgxMjUgCkwgOC41IDU0LjY4NzUgCkwgMTcuNDg0Mzc1IDU0LjY4NzUgCkwgMTcuNDg0Mzc1IDIxLjkyMTg3NSAKUSAxNy40ODQzNzUgMTQuMTU2MjUgMjAuNSAxMC4yNjU2MjUgClEgMjMuNTMxMjUgNi4zOTA2MjUgMjkuNTkzNzUgNi4zOTA2MjUgClEgMzYuODU5Mzc1IDYuMzkwNjI1IDQxLjA3ODEyNSAxMS4wMzEyNSAKUSA0NS4zMTI1IDE1LjY3MTg3NSA0NS4zMTI1IDIzLjY4NzUgCkwgNDUuMzEyNSA1NC42ODc1IApMIDU0LjI5Njg3NSA1NC42ODc1IApMIDU0LjI5Njg3NSAwIApMIDQ1LjMxMjUgMCAKTCA0NS4zMTI1IDguNDA2MjUgClEgNDIuMDQ2ODc1IDMuNDIxODc1IDM3LjcxODc1IDEgClEgMzMuNDA2MjUgLTEuNDIxODc1IDI3LjY4NzUgLTEuNDIxODc1IApRIDE4LjI2NTYyNSAtMS40MjE4NzUgMTMuMzc1IDQuNDM3NSAKUSA4LjUgMTAuMjk2ODc1IDguNSAyMS41NzgxMjUgCnoKTSAzMS4xMDkzNzUgNTYgCnoKIiBpZD0iRGVqYVZ1U2Fucy0xMTciLz4KICAgICAgPHBhdGggaWQ9IkRlamFWdVNhbnMtMzIiLz4KICAgICAgPHBhdGggZD0iTSAxOS42NzE4NzUgNjQuNzk2ODc1IApMIDE5LjY3MTg3NSA4LjEwOTM3NSAKTCAzMS41OTM3NSA4LjEwOTM3NSAKUSA0Ni42ODc1IDguMTA5Mzc1IDUzLjY4NzUgMTQuOTM3NSAKUSA2MC42ODc1IDIxLjc4MTI1IDYwLjY4NzUgMzYuNTMxMjUgClEgNjAuNjg3NSA1MS4xNzE4NzUgNTMuNjg3NSA1Ny45ODQzNzUgClEgNDYuNjg3NSA2NC43OTY4NzUgMzEuNTkzNzUgNjQuNzk2ODc1IAp6Ck0gOS44MTI1IDcyLjkwNjI1IApMIDMwLjA3ODEyNSA3Mi45MDYyNSAKUSA1MS4yNjU2MjUgNzIuOTA2MjUgNjEuMTcxODc1IDY0LjA5Mzc1IApRIDcxLjA5Mzc1IDU1LjI4MTI1IDcxLjA5Mzc1IDM2LjUzMTI1IApRIDcxLjA5Mzc1IDE3LjY3MTg3NSA2MS4xMjUgOC44MjgxMjUgClEgNTEuMTcxODc1IDAgMzAuMDc4MTI1IDAgCkwgOS44MTI1IDAgCnoKIiBpZD0iRGVqYVZ1U2Fucy02OCIvPgogICAgICA8cGF0aCBkPSJNIDUyIDQ0LjE4NzUgClEgNTUuMzc1IDUwLjI1IDYwLjA2MjUgNTMuMTI1IApRIDY0Ljc1IDU2IDcxLjA5Mzc1IDU2IApRIDc5LjY0MDYyNSA1NiA4NC4yODEyNSA1MC4wMTU2MjUgClEgODguOTIxODc1IDQ0LjA0Njg3NSA4OC45MjE4NzUgMzMuMDE1NjI1IApMIDg4LjkyMTg3NSAwIApMIDc5Ljg5MDYyNSAwIApMIDc5Ljg5MDYyNSAzMi43MTg3NSAKUSA3OS44OTA2MjUgNDAuNTc4MTI1IDc3LjA5Mzc1IDQ0LjM3NSAKUSA3NC4zMTI1IDQ4LjE4NzUgNjguNjA5Mzc1IDQ4LjE4NzUgClEgNjEuNjI1IDQ4LjE4NzUgNTcuNTYyNSA0My41NDY4NzUgClEgNTMuNTE1NjI1IDM4LjkyMTg3NSA1My41MTU2MjUgMzAuOTA2MjUgCkwgNTMuNTE1NjI1IDAgCkwgNDQuNDg0Mzc1IDAgCkwgNDQuNDg0Mzc1IDMyLjcxODc1IApRIDQ0LjQ4NDM3NSA0MC42MjUgNDEuNzAzMTI1IDQ0LjQwNjI1IApRIDM4LjkyMTg3NSA0OC4xODc1IDMzLjEwOTM3NSA0OC4xODc1IApRIDI2LjIxODc1IDQ4LjE4NzUgMjIuMTU2MjUgNDMuNTMxMjUgClEgMTguMTA5Mzc1IDM4Ljg3NSAxOC4xMDkzNzUgMzAuOTA2MjUgCkwgMTguMTA5Mzc1IDAgCkwgOS4wNzgxMjUgMCAKTCA5LjA3ODEyNSA1NC42ODc1IApMIDE4LjEwOTM3NSA1NC42ODc1IApMIDE4LjEwOTM3NSA0Ni4xODc1IApRIDIxLjE4NzUgNTEuMjE4NzUgMjUuNDg0Mzc1IDUzLjYwOTM3NSAKUSAyOS43ODEyNSA1NiAzNS42ODc1IDU2IApRIDQxLjY1NjI1IDU2IDQ1LjgyODEyNSA1Mi45Njg3NSAKUSA1MCA0OS45NTMxMjUgNTIgNDQuMTg3NSAKegoiIGlkPSJEZWphVnVTYW5zLTEwOSIvPgogICAgICA8cGF0aCBkPSJNIDMxIDc1Ljg3NSAKUSAyNC40Njg3NSA2NC42NTYyNSAyMS4yODEyNSA1My42NTYyNSAKUSAxOC4xMDkzNzUgNDIuNjcxODc1IDE4LjEwOTM3NSAzMS4zOTA2MjUgClEgMTguMTA5Mzc1IDIwLjEyNSAyMS4zMTI1IDkuMDYyNSAKUSAyNC41MTU2MjUgLTIgMzEgLTEzLjE4NzUgCkwgMjMuMTg3NSAtMTMuMTg3NSAKUSAxNS44NzUgLTEuNzAzMTI1IDEyLjIzNDM3NSA5LjM3NSAKUSA4LjU5Mzc1IDIwLjQ1MzEyNSA4LjU5Mzc1IDMxLjM5MDYyNSAKUSA4LjU5Mzc1IDQyLjI4MTI1IDEyLjIwMzEyNSA1My4zMTI1IApRIDE1LjgyODEyNSA2NC4zNTkzNzUgMjMuMTg3NSA3NS44NzUgCnoKIiBpZD0iRGVqYVZ1U2Fucy00MCIvPgogICAgICA8cGF0aCBkPSJNIDEwLjU5Mzc1IDQ1LjQwNjI1IApMIDczLjE4NzUgNDUuNDA2MjUgCkwgNzMuMTg3NSAzNy4yMDMxMjUgCkwgMTAuNTkzNzUgMzcuMjAzMTI1IAp6Ck0gMTAuNTkzNzUgMjUuNDg0Mzc1IApMIDczLjE4NzUgMjUuNDg0Mzc1IApMIDczLjE4NzUgMTcuMTg3NSAKTCAxMC41OTM3NSAxNy4xODc1IAp6CiIgaWQ9IkRlamFWdVNhbnMtNjEiLz4KICAgICAgPHBhdGggZD0iTSA0NiA2Mi43MDMxMjUgCkwgNDYgMzUuNSAKTCA3My4xODc1IDM1LjUgCkwgNzMuMTg3NSAyNy4yMDMxMjUgCkwgNDYgMjcuMjAzMTI1IApMIDQ2IDAgCkwgMzcuNzk2ODc1IDAgCkwgMzcuNzk2ODc1IDI3LjIwMzEyNSAKTCAxMC41OTM3NSAyNy4yMDMxMjUgCkwgMTAuNTkzNzUgMzUuNSAKTCAzNy43OTY4NzUgMzUuNSAKTCAzNy43OTY4NzUgNjIuNzAzMTI1IAp6CiIgaWQ9IkRlamFWdVNhbnMtNDMiLz4KICAgICAgPHBhdGggZD0iTSAxMi40MDYyNSA4LjI5Njg3NSAKTCAyOC41MTU2MjUgOC4yOTY4NzUgCkwgMjguNTE1NjI1IDYzLjkyMTg3NSAKTCAxMC45ODQzNzUgNjAuNDA2MjUgCkwgMTAuOTg0Mzc1IDY5LjM5MDYyNSAKTCAyOC40MjE4NzUgNzIuOTA2MjUgCkwgMzguMjgxMjUgNzIuOTA2MjUgCkwgMzguMjgxMjUgOC4yOTY4NzUgCkwgNTQuMzkwNjI1IDguMjk2ODc1IApMIDU0LjM5MDYyNSAwIApMIDEyLjQwNjI1IDAgCnoKIiBpZD0iRGVqYVZ1U2Fucy00OSIvPgogICAgICA8cGF0aCBkPSJNIDguMDE1NjI1IDc1Ljg3NSAKTCAxNS44MjgxMjUgNzUuODc1IApRIDIzLjE0MDYyNSA2NC4zNTkzNzUgMjYuNzgxMjUgNTMuMzEyNSAKUSAzMC40MjE4NzUgNDIuMjgxMjUgMzAuNDIxODc1IDMxLjM5MDYyNSAKUSAzMC40MjE4NzUgMjAuNDUzMTI1IDI2Ljc4MTI1IDkuMzc1IApRIDIzLjE0MDYyNSAtMS43MDMxMjUgMTUuODI4MTI1IC0xMy4xODc1IApMIDguMDE1NjI1IC0xMy4xODc1IApRIDE0LjUgLTIgMTcuNzAzMTI1IDkuMDYyNSAKUSAyMC45MDYyNSAyMC4xMjUgMjAuOTA2MjUgMzEuMzkwNjI1IApRIDIwLjkwNjI1IDQyLjY3MTg3NSAxNy43MDMxMjUgNTMuNjU2MjUgClEgMTQuNSA2NC42NTYyNSA4LjAxNTYyNSA3NS44NzUgCnoKIiBpZD0iRGVqYVZ1U2Fucy00MSIvPgogICAgIDwvZGVmcz4KICAgICA8ZyBzdHlsZT0iZmlsbDojMjYyNjI2OyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTEzLjQ1NjcxOSAyODAuMjc2NTYzKXNjYWxlKDAuMSAtMC4xKSI+CiAgICAgIDx1c2UgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtNzMiLz4KICAgICAgPHVzZSB4PSIyOS40OTIxODgiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExMCIvPgogICAgICA8dXNlIHg9IjkyLjg3MTA5NCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTAwIi8+CiAgICAgIDx1c2UgeD0iMTU2LjM0NzY1NiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTE3Ii8+CiAgICAgIDx1c2UgeD0iMjE5LjcyNjU2MiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtOTkiLz4KICAgICAgPHVzZSB4PSIyNzQuNzA3MDMxIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDEiLz4KICAgICAgPHVzZSB4PSIzMzYuMjMwNDY5IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDAiLz4KICAgICAgPHVzZSB4PSIzOTkuNzA3MDMxIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0zMiIvPgogICAgICA8dXNlIHg9IjQzMS40OTQxNDEiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTY4Ii8+CiAgICAgIDx1c2UgeD0iNTA4LjQ5NjA5NCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTExIi8+CiAgICAgIDx1c2UgeD0iNTY5LjY3NzczNCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTA5Ii8+CiAgICAgIDx1c2UgeD0iNjY3LjA4OTg0NCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtOTciLz4KICAgICAgPHVzZSB4PSI3MjguMzY5MTQxIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDUiLz4KICAgICAgPHVzZSB4PSI3NTYuMTUyMzQ0IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTAiLz4KICAgICAgPHVzZSB4PSI4MTkuNTMxMjUiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTMyIi8+CiAgICAgIDx1c2UgeD0iODUxLjMxODM1OSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtNDAiLz4KICAgICAgPHVzZSB4PSI4OTAuMzMyMDMxIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTYiLz4KICAgICAgPHVzZSB4PSI5MjkuNTQxMDE2IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDUiLz4KICAgICAgPHVzZSB4PSI5NTcuMzI0MjE5IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDkiLz4KICAgICAgPHVzZSB4PSIxMDU0LjczNjMyOCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTAxIi8+CiAgICAgIDx1c2UgeD0iMTExNi4yNTk3NjYiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTMyIi8+CiAgICAgIDx1c2UgeD0iMTE0OC4wNDY4NzUiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTYxIi8+CiAgICAgIDx1c2UgeD0iMTIzMS44MzU5MzgiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTMyIi8+CiAgICAgIDx1c2UgeD0iMTI2My42MjMwNDciIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExNiIvPgogICAgICA8dXNlIHg9IjEzMDIuODMyMDMxIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy00MyIvPgogICAgICA8dXNlIHg9IjEzODYuNjIxMDk0IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy00OSIvPgogICAgICA8dXNlIHg9IjE0NTAuMjQ0MTQxIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy00MSIvPgogICAgIDwvZz4KICAgIDwvZz4KICAgPC9nPgogICA8ZyBpZD0ibWF0cGxvdGxpYi5heGlzXzIiPgogICAgPGcgaWQ9Inl0aWNrXzEiPgogICAgIDxnIGlkPSJ0ZXh0XzciPgogICAgICA8IS0tIE1vb2QgLS0+CiAgICAgIDxnIHN0eWxlPSJmaWxsOiMyNjI2MjY7IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxOS43ODU5MzcgNjAuMTAzMjE5KXNjYWxlKDAuMSAtMC4xKSI+CiAgICAgICA8dXNlIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTc3Ii8+CiAgICAgICA8dXNlIHg9Ijg2LjI3OTI5NyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTExIi8+CiAgICAgICA8dXNlIHg9IjE0Ny40NjA5MzgiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExMSIvPgogICAgICAgPHVzZSB4PSIyMDguNjQyNTc4IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDAiLz4KICAgICAgPC9nPgogICAgIDwvZz4KICAgIDwvZz4KICAgIDxnIGlkPSJ5dGlja18yIj4KICAgICA8ZyBpZD0idGV4dF84Ij4KICAgICAgPCEtLSBBbnhpZXR5IC0tPgogICAgICA8ZyBzdHlsZT0iZmlsbDojMjYyNjI2OyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoOS4xMzI4MTIgMTAzLjU5MTIxOSlzY2FsZSgwLjEgLTAuMSkiPgogICAgICAgPHVzZSB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy02NSIvPgogICAgICAgPHVzZSB4PSI2OC40MDgyMDMiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExMCIvPgogICAgICAgPHVzZSB4PSIxMzEuNzg3MTA5IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMjAiLz4KICAgICAgIDx1c2UgeD0iMTkwLjk2Njc5NyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTA1Ii8+CiAgICAgICA8dXNlIHg9IjIxOC43NSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTAxIi8+CiAgICAgICA8dXNlIHg9IjI4MC4yNzM0MzgiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExNiIvPgogICAgICAgPHVzZSB4PSIzMTkuNDgyNDIyIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMjEiLz4KICAgICAgPC9nPgogICAgIDwvZz4KICAgIDwvZz4KICAgIDxnIGlkPSJ5dGlja18zIj4KICAgICA8ZyBpZD0idGV4dF85Ij4KICAgICAgPCEtLSBQc3ljaG9zaXMgLS0+CiAgICAgIDxnIHN0eWxlPSJmaWxsOiMyNjI2MjY7IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMS4zMDc4MTMgMTQ3LjA3OTIxOSlzY2FsZSgwLjEgLTAuMSkiPgogICAgICAgPHVzZSB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy04MCIvPgogICAgICAgPHVzZSB4PSI2MC4yODcxMDkiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExNSIvPgogICAgICAgPHVzZSB4PSIxMTIuMzg2NzE5IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMjEiLz4KICAgICAgIDx1c2UgeD0iMTcxLjU2NjQwNiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtOTkiLz4KICAgICAgIDx1c2UgeD0iMjI2LjU0Njg3NSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTA0Ii8+CiAgICAgICA8dXNlIHg9IjI4OS45MjU3ODEiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExMSIvPgogICAgICAgPHVzZSB4PSIzNTEuMTA3NDIyIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTUiLz4KICAgICAgIDx1c2UgeD0iNDAzLjIwNzAzMSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTA1Ii8+CiAgICAgICA8dXNlIHg9IjQzMC45OTAyMzQiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExNSIvPgogICAgICA8L2c+CiAgICAgPC9nPgogICAgPC9nPgogICAgPGcgaWQ9Inl0aWNrXzQiPgogICAgIDxnIGlkPSJ0ZXh0XzEwIj4KICAgICAgPCEtLSBTbGVlcCAtLT4KICAgICAgPGcgc3R5bGU9ImZpbGw6IzI2MjYyNjsiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE5LjIxODc1IDE5MC41NjcyMTkpc2NhbGUoMC4xIC0wLjEpIj4KICAgICAgIDx1c2UgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtODMiLz4KICAgICAgIDx1c2UgeD0iNjMuNDc2NTYyIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDgiLz4KICAgICAgIDx1c2UgeD0iOTEuMjU5NzY2IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDEiLz4KICAgICAgIDx1c2UgeD0iMTUyLjc4MzIwMyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTAxIi8+CiAgICAgICA8dXNlIHg9IjIxNC4zMDY2NDEiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExMiIvPgogICAgICA8L2c+CiAgICAgPC9nPgogICAgPC9nPgogICAgPGcgaWQ9Inl0aWNrXzUiPgogICAgIDxnIGlkPSJ0ZXh0XzExIj4KICAgICAgPCEtLSBTb2NpYWwgLS0+CiAgICAgIDxnIHN0eWxlPSJmaWxsOiMyNjI2MjY7IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxNy4zNSAyMzQuMDU1MjE5KXNjYWxlKDAuMSAtMC4xKSI+CiAgICAgICA8dXNlIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTgzIi8+CiAgICAgICA8dXNlIHg9IjYzLjQ3NjU2MiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTExIi8+CiAgICAgICA8dXNlIHg9IjEyNC42NTgyMDMiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTk5Ii8+CiAgICAgICA8dXNlIHg9IjE3OS42Mzg2NzIiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTEwNSIvPgogICAgICAgPHVzZSB4PSIyMDcuNDIxODc1IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy05NyIvPgogICAgICAgPHVzZSB4PSIyNjguNzAxMTcyIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDgiLz4KICAgICAgPC9nPgogICAgIDwvZz4KICAgIDwvZz4KICAgIDxnIGlkPSJ0ZXh0XzEyIj4KICAgICA8IS0tIEVsZXZhdGVkIERvbWFpbiAodGltZSA9IHQpIC0tPgogICAgIDxkZWZzPgogICAgICA8cGF0aCBkPSJNIDkuODEyNSA3Mi45MDYyNSAKTCA1NS45MDYyNSA3Mi45MDYyNSAKTCA1NS45MDYyNSA2NC41OTM3NSAKTCAxOS42NzE4NzUgNjQuNTkzNzUgCkwgMTkuNjcxODc1IDQzLjAxNTYyNSAKTCA1NC4zOTA2MjUgNDMuMDE1NjI1IApMIDU0LjM5MDYyNSAzNC43MTg3NSAKTCAxOS42NzE4NzUgMzQuNzE4NzUgCkwgMTkuNjcxODc1IDguMjk2ODc1IApMIDU2Ljc4MTI1IDguMjk2ODc1IApMIDU2Ljc4MTI1IDAgCkwgOS44MTI1IDAgCnoKIiBpZD0iRGVqYVZ1U2Fucy02OSIvPgogICAgICA8cGF0aCBkPSJNIDIuOTg0Mzc1IDU0LjY4NzUgCkwgMTIuNSA1NC42ODc1IApMIDI5LjU5Mzc1IDguNzk2ODc1IApMIDQ2LjY4NzUgNTQuNjg3NSAKTCA1Ni4yMDMxMjUgNTQuNjg3NSAKTCAzNS42ODc1IDAgCkwgMjMuNDg0Mzc1IDAgCnoKIiBpZD0iRGVqYVZ1U2Fucy0xMTgiLz4KICAgICA8L2RlZnM+CiAgICAgPGcgc3R5bGU9ImZpbGw6IzI2MjYyNjsiIHRyYW5zZm9ybT0idHJhbnNsYXRlKC03LjM4NzUgMjEyLjI0NDg0NClyb3RhdGUoLTkwKXNjYWxlKDAuMSAtMC4xKSI+CiAgICAgIDx1c2UgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtNjkiLz4KICAgICAgPHVzZSB4PSI2My4xODM1OTQiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTEwOCIvPgogICAgICA8dXNlIHg9IjkwLjk2Njc5NyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTAxIi8+CiAgICAgIDx1c2UgeD0iMTUyLjQ5MDIzNCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTE4Ii8+CiAgICAgIDx1c2UgeD0iMjExLjY2OTkyMiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtOTciLz4KICAgICAgPHVzZSB4PSIyNzIuOTQ5MjE5IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTYiLz4KICAgICAgPHVzZSB4PSIzMTIuMTU4MjAzIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDEiLz4KICAgICAgPHVzZSB4PSIzNzMuNjgxNjQxIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDAiLz4KICAgICAgPHVzZSB4PSI0MzcuMTU4MjAzIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0zMiIvPgogICAgICA8dXNlIHg9IjQ2OC45NDUzMTIiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTY4Ii8+CiAgICAgIDx1c2UgeD0iNTQ1Ljk0NzI2NiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTExIi8+CiAgICAgIDx1c2UgeD0iNjA3LjEyODkwNiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTA5Ii8+CiAgICAgIDx1c2UgeD0iNzA0LjU0MTAxNiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtOTciLz4KICAgICAgPHVzZSB4PSI3NjUuODIwMzEyIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDUiLz4KICAgICAgPHVzZSB4PSI3OTMuNjAzNTE2IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTAiLz4KICAgICAgPHVzZSB4PSI4NTYuOTgyNDIyIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0zMiIvPgogICAgICA8dXNlIHg9Ijg4OC43Njk1MzEiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTQwIi8+CiAgICAgIDx1c2UgeD0iOTI3Ljc4MzIwMyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTE2Ii8+CiAgICAgIDx1c2UgeD0iOTY2Ljk5MjE4OCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTA1Ii8+CiAgICAgIDx1c2UgeD0iOTk0Ljc3NTM5MSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTA5Ii8+CiAgICAgIDx1c2UgeD0iMTA5Mi4xODc1IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDEiLz4KICAgICAgPHVzZSB4PSIxMTUzLjcxMDkzOCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMzIiLz4KICAgICAgPHVzZSB4PSIxMTg1LjQ5ODA0NyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtNjEiLz4KICAgICAgPHVzZSB4PSIxMjY5LjI4NzEwOSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMzIiLz4KICAgICAgPHVzZSB4PSIxMzAxLjA3NDIxOSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTE2Ii8+CiAgICAgIDx1c2UgeD0iMTM0MC4yODMyMDMiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTQxIi8+CiAgICAgPC9nPgogICAgPC9nPgogICA8L2c+CiAgIDxnIGlkPSJRdWFkTWVzaF8xIj4KICAgIDxwYXRoIGNsaXAtcGF0aD0idXJsKCNwZmRiOWQ4YzU4YikiIGQ9Ik0gNTQgMzQuNTYgCkwgMTA3LjU2OCAzNC41NiAKTCAxMDcuNTY4IDc4LjA0OCAKTCA1NCA3OC4wNDggCkwgNTQgMzQuNTYgCiIgc3R5bGU9ImZpbGw6bm9uZTsiLz4KICAgIDxwYXRoIGNsaXAtcGF0aD0idXJsKCNwZmRiOWQ4YzU4YikiIGQ9Ik0gMTA3LjU2OCAzNC41NiAKTCAxNjEuMTM2IDM0LjU2IApMIDE2MS4xMzYgNzguMDQ4IApMIDEwNy41NjggNzguMDQ4IApMIDEwNy41NjggMzQuNTYgCiIgc3R5bGU9ImZpbGw6I2Y3YjE5NDsiLz4KICAgIDxwYXRoIGNsaXAtcGF0aD0idXJsKCNwZmRiOWQ4YzU4YikiIGQ9Ik0gMTYxLjEzNiAzNC41NiAKTCAyMTQuNzA0IDM0LjU2IApMIDIxNC43MDQgNzguMDQ4IApMIDE2MS4xMzYgNzguMDQ4IApMIDE2MS4xMzYgMzQuNTYgCiIgc3R5bGU9ImZpbGw6I2Y3Yjg5YzsiLz4KICAgIDxwYXRoIGNsaXAtcGF0aD0idXJsKCNwZmRiOWQ4YzU4YikiIGQ9Ik0gMjE0LjcwNCAzNC41NiAKTCAyNjguMjcyIDM0LjU2IApMIDI2OC4yNzIgNzguMDQ4IApMIDIxNC43MDQgNzguMDQ4IApMIDIxNC43MDQgMzQuNTYgCiIgc3R5bGU9ImZpbGw6I2Y3YjU5OTsiLz4KICAgIDxwYXRoIGNsaXAtcGF0aD0idXJsKCNwZmRiOWQ4YzU4YikiIGQ9Ik0gMjY4LjI3MiAzNC41NiAKTCAzMjEuODQgMzQuNTYgCkwgMzIxLjg0IDc4LjA0OCAKTCAyNjguMjcyIDc4LjA0OCAKTCAyNjguMjcyIDM0LjU2IAoiIHN0eWxlPSJmaWxsOiNmNWMwYTc7Ii8+CiAgICA8cGF0aCBjbGlwLXBhdGg9InVybCgjcGZkYjlkOGM1OGIpIiBkPSJNIDU0IDc4LjA0OCAKTCAxMDcuNTY4IDc4LjA0OCAKTCAxMDcuNTY4IDEyMS41MzYgCkwgNTQgMTIxLjUzNiAKTCA1NCA3OC4wNDggCiIgc3R5bGU9ImZpbGw6I2VlODQ2ODsiLz4KICAgIDxwYXRoIGNsaXAtcGF0aD0idXJsKCNwZmRiOWQ4YzU4YikiIGQ9Ik0gMTA3LjU2OCA3OC4wNDggCkwgMTYxLjEzNiA3OC4wNDggCkwgMTYxLjEzNiAxMjEuNTM2IApMIDEwNy41NjggMTIxLjUzNiAKTCAxMDcuNTY4IDc4LjA0OCAKIiBzdHlsZT0iZmlsbDpub25lOyIvPgogICAgPHBhdGggY2xpcC1wYXRoPSJ1cmwoI3BmZGI5ZDhjNThiKSIgZD0iTSAxNjEuMTM2IDc4LjA0OCAKTCAyMTQuNzA0IDc4LjA0OCAKTCAyMTQuNzA0IDEyMS41MzYgCkwgMTYxLjEzNiAxMjEuNTM2IApMIDE2MS4xMzYgNzguMDQ4IAoiIHN0eWxlPSJmaWxsOiNmN2I3OWI7Ii8+CiAgICA8cGF0aCBjbGlwLXBhdGg9InVybCgjcGZkYjlkOGM1OGIpIiBkPSJNIDIxNC43MDQgNzguMDQ4IApMIDI2OC4yNzIgNzguMDQ4IApMIDI2OC4yNzIgMTIxLjUzNiAKTCAyMTQuNzA0IDEyMS41MzYgCkwgMjE0LjcwNCA3OC4wNDggCiIgc3R5bGU9ImZpbGw6I2Y2YTM4NTsiLz4KICAgIDxwYXRoIGNsaXAtcGF0aD0idXJsKCNwZmRiOWQ4YzU4YikiIGQ9Ik0gMjY4LjI3MiA3OC4wNDggCkwgMzIxLjg0IDc4LjA0OCAKTCAzMjEuODQgMTIxLjUzNiAKTCAyNjguMjcyIDEyMS41MzYgCkwgMjY4LjI3MiA3OC4wNDggCiIgc3R5bGU9ImZpbGw6I2VkZDFjMjsiLz4KICAgIDxwYXRoIGNsaXAtcGF0aD0idXJsKCNwZmRiOWQ4YzU4YikiIGQ9Ik0gNTQgMTIxLjUzNiAKTCAxMDcuNTY4IDEyMS41MzYgCkwgMTA3LjU2OCAxNjUuMDI0IApMIDU0IDE2NS4wMjQgCkwgNTQgMTIxLjUzNiAKIiBzdHlsZT0iZmlsbDojZjZhMjgzOyIvPgogICAgPHBhdGggY2xpcC1wYXRoPSJ1cmwoI3BmZGI5ZDhjNThiKSIgZD0iTSAxMDcuNTY4IDEyMS41MzYgCkwgMTYxLjEzNiAxMjEuNTM2IApMIDE2MS4xMzYgMTY1LjAyNCAKTCAxMDcuNTY4IDE2NS4wMjQgCkwgMTA3LjU2OCAxMjEuNTM2IAoiIHN0eWxlPSJmaWxsOiNmN2I5OWU7Ii8+CiAgICA8cGF0aCBjbGlwLXBhdGg9InVybCgjcGZkYjlkOGM1OGIpIiBkPSJNIDE2MS4xMzYgMTIxLjUzNiAKTCAyMTQuNzA0IDEyMS41MzYgCkwgMjE0LjcwNCAxNjUuMDI0IApMIDE2MS4xMzYgMTY1LjAyNCAKTCAxNjEuMTM2IDEyMS41MzYgCiIgc3R5bGU9ImZpbGw6bm9uZTsiLz4KICAgIDxwYXRoIGNsaXAtcGF0aD0idXJsKCNwZmRiOWQ4YzU4YikiIGQ9Ik0gMjE0LjcwNCAxMjEuNTM2IApMIDI2OC4yNzIgMTIxLjUzNiAKTCAyNjguMjcyIDE2NS4wMjQgCkwgMjE0LjcwNCAxNjUuMDI0IApMIDIxNC43MDQgMTIxLjUzNiAKIiBzdHlsZT0iZmlsbDojZjdiY2ExOyIvPgogICAgPHBhdGggY2xpcC1wYXRoPSJ1cmwoI3BmZGI5ZDhjNThiKSIgZD0iTSAyNjguMjcyIDEyMS41MzYgCkwgMzIxLjg0IDEyMS41MzYgCkwgMzIxLjg0IDE2NS4wMjQgCkwgMjY4LjI3MiAxNjUuMDI0IApMIDI2OC4yNzIgMTIxLjUzNiAKIiBzdHlsZT0iZmlsbDojZWVkMGMwOyIvPgogICAgPHBhdGggY2xpcC1wYXRoPSJ1cmwoI3BmZGI5ZDhjNThiKSIgZD0iTSA1NCAxNjUuMDI0IApMIDEwNy41NjggMTY1LjAyNCAKTCAxMDcuNTY4IDIwOC41MTIgCkwgNTQgMjA4LjUxMiAKTCA1NCAxNjUuMDI0IAoiIHN0eWxlPSJmaWxsOiNmN2I5OWU7Ii8+CiAgICA8cGF0aCBjbGlwLXBhdGg9InVybCgjcGZkYjlkOGM1OGIpIiBkPSJNIDEwNy41NjggMTY1LjAyNCAKTCAxNjEuMTM2IDE2NS4wMjQgCkwgMTYxLjEzNiAyMDguNTEyIApMIDEwNy41NjggMjA4LjUxMiAKTCAxMDcuNTY4IDE2NS4wMjQgCiIgc3R5bGU9ImZpbGw6I2Y3YmE5ZjsiLz4KICAgIDxwYXRoIGNsaXAtcGF0aD0idXJsKCNwZmRiOWQ4YzU4YikiIGQ9Ik0gMTYxLjEzNiAxNjUuMDI0IApMIDIxNC43MDQgMTY1LjAyNCAKTCAyMTQuNzA0IDIwOC41MTIgCkwgMTYxLjEzNiAyMDguNTEyIApMIDE2MS4xMzYgMTY1LjAyNCAKIiBzdHlsZT0iZmlsbDojZjdiYTlmOyIvPgogICAgPHBhdGggY2xpcC1wYXRoPSJ1cmwoI3BmZGI5ZDhjNThiKSIgZD0iTSAyMTQuNzA0IDE2NS4wMjQgCkwgMjY4LjI3MiAxNjUuMDI0IApMIDI2OC4yNzIgMjA4LjUxMiAKTCAyMTQuNzA0IDIwOC41MTIgCkwgMjE0LjcwNCAxNjUuMDI0IAoiIHN0eWxlPSJmaWxsOm5vbmU7Ii8+CiAgICA8cGF0aCBjbGlwLXBhdGg9InVybCgjcGZkYjlkOGM1OGIpIiBkPSJNIDI2OC4yNzIgMTY1LjAyNCAKTCAzMjEuODQgMTY1LjAyNCAKTCAzMjEuODQgMjA4LjUxMiAKTCAyNjguMjcyIDIwOC41MTIgCkwgMjY4LjI3MiAxNjUuMDI0IAoiIHN0eWxlPSJmaWxsOiNmM2M3YjE7Ii8+CiAgICA8cGF0aCBjbGlwLXBhdGg9InVybCgjcGZkYjlkOGM1OGIpIiBkPSJNIDU0IDIwOC41MTIgCkwgMTA3LjU2OCAyMDguNTEyIApMIDEwNy41NjggMjUyIApMIDU0IDI1MiAKTCA1NCAyMDguNTEyIAoiIHN0eWxlPSJmaWxsOiNmNWMyYWE7Ii8+CiAgICA8cGF0aCBjbGlwLXBhdGg9InVybCgjcGZkYjlkOGM1OGIpIiBkPSJNIDEwNy41NjggMjA4LjUxMiAKTCAxNjEuMTM2IDIwOC41MTIgCkwgMTYxLjEzNiAyNTIgCkwgMTA3LjU2OCAyNTIgCkwgMTA3LjU2OCAyMDguNTEyIAoiIHN0eWxlPSJmaWxsOiNlZmNlYmQ7Ii8+CiAgICA8cGF0aCBjbGlwLXBhdGg9InVybCgjcGZkYjlkOGM1OGIpIiBkPSJNIDE2MS4xMzYgMjA4LjUxMiAKTCAyMTQuNzA0IDIwOC41MTIgCkwgMjE0LjcwNCAyNTIgCkwgMTYxLjEzNiAyNTIgCkwgMTYxLjEzNiAyMDguNTEyIAoiIHN0eWxlPSJmaWxsOiNmNWMyYWE7Ii8+CiAgICA8cGF0aCBjbGlwLXBhdGg9InVybCgjcGZkYjlkOGM1OGIpIiBkPSJNIDIxNC43MDQgMjA4LjUxMiAKTCAyNjguMjcyIDIwOC41MTIgCkwgMjY4LjI3MiAyNTIgCkwgMjE0LjcwNCAyNTIgCkwgMjE0LjcwNCAyMDguNTEyIAoiIHN0eWxlPSJmaWxsOiNmN2E5OGI7Ii8+CiAgICA8cGF0aCBjbGlwLXBhdGg9InVybCgjcGZkYjlkOGM1OGIpIiBkPSJNIDI2OC4yNzIgMjA4LjUxMiAKTCAzMjEuODQgMjA4LjUxMiAKTCAzMjEuODQgMjUyIApMIDI2OC4yNzIgMjUyIApMIDI2OC4yNzIgMjA4LjUxMiAKIiBzdHlsZT0iZmlsbDpub25lOyIvPgogICA8L2c+CiAgIDxnIGlkPSJ0ZXh0XzEzIj4KICAgIDwhLS0gQWxsIFBhdGllbnRzOiBJbmR1Y2VkIFRyYW5zaXRpb25zIC0tPgogICAgPGRlZnM+CiAgICAgPHBhdGggZD0iTSAxMS43MTg3NSAxMi40MDYyNSAKTCAyMi4wMTU2MjUgMTIuNDA2MjUgCkwgMjIuMDE1NjI1IDAgCkwgMTEuNzE4NzUgMCAKegpNIDExLjcxODc1IDUxLjcwMzEyNSAKTCAyMi4wMTU2MjUgNTEuNzAzMTI1IApMIDIyLjAxNTYyNSAzOS4zMTI1IApMIDExLjcxODc1IDM5LjMxMjUgCnoKIiBpZD0iRGVqYVZ1U2Fucy01OCIvPgogICAgIDxwYXRoIGQ9Ik0gLTAuMjk2ODc1IDcyLjkwNjI1IApMIDYxLjM3NSA3Mi45MDYyNSAKTCA2MS4zNzUgNjQuNTkzNzUgCkwgMzUuNSA2NC41OTM3NSAKTCAzNS41IDAgCkwgMjUuNTkzNzUgMCAKTCAyNS41OTM3NSA2NC41OTM3NSAKTCAtMC4yOTY4NzUgNjQuNTkzNzUgCnoKIiBpZD0iRGVqYVZ1U2Fucy04NCIvPgogICAgIDxwYXRoIGQ9Ik0gNDEuMTA5Mzc1IDQ2LjI5Njg3NSAKUSAzOS41OTM3NSA0Ny4xNzE4NzUgMzcuODEyNSA0Ny41NzgxMjUgClEgMzYuMDMxMjUgNDggMzMuODkwNjI1IDQ4IApRIDI2LjI2NTYyNSA0OCAyMi4xODc1IDQzLjA0Njg3NSAKUSAxOC4xMDkzNzUgMzguMDkzNzUgMTguMTA5Mzc1IDI4LjgxMjUgCkwgMTguMTA5Mzc1IDAgCkwgOS4wNzgxMjUgMCAKTCA5LjA3ODEyNSA1NC42ODc1IApMIDE4LjEwOTM3NSA1NC42ODc1IApMIDE4LjEwOTM3NSA0Ni4xODc1IApRIDIwLjk1MzEyNSA1MS4xNzE4NzUgMjUuNDg0Mzc1IDUzLjU3ODEyNSAKUSAzMC4wMzEyNSA1NiAzNi41MzEyNSA1NiAKUSAzNy40NTMxMjUgNTYgMzguNTc4MTI1IDU1Ljg3NSAKUSAzOS43MDMxMjUgNTUuNzY1NjI1IDQxLjA2MjUgNTUuNTE1NjI1IAp6CiIgaWQ9IkRlamFWdVNhbnMtMTE0Ii8+CiAgICA8L2RlZnM+CiAgICA8ZyBzdHlsZT0iZmlsbDojMjYyNjI2OyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoOTEuNDY1MzEzIDI4LjU2KXNjYWxlKDAuMTIgLTAuMTIpIj4KICAgICA8dXNlIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTY1Ii8+CiAgICAgPHVzZSB4PSI2OC40MDgyMDMiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTEwOCIvPgogICAgIDx1c2UgeD0iOTYuMTkxNDA2IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDgiLz4KICAgICA8dXNlIHg9IjEyMy45NzQ2MDkiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTMyIi8+CiAgICAgPHVzZSB4PSIxNTUuNzYxNzE5IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy04MCIvPgogICAgIDx1c2UgeD0iMjE2LjAwMTk1MyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtOTciLz4KICAgICA8dXNlIHg9IjI3Ny4yODEyNSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTE2Ii8+CiAgICAgPHVzZSB4PSIzMTYuNDkwMjM0IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDUiLz4KICAgICA8dXNlIHg9IjM0NC4yNzM0MzgiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTEwMSIvPgogICAgIDx1c2UgeD0iNDA1Ljc5Njg3NSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTEwIi8+CiAgICAgPHVzZSB4PSI0NjkuMTc1NzgxIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTYiLz4KICAgICA8dXNlIHg9IjUwOC4zODQ3NjYiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExNSIvPgogICAgIDx1c2UgeD0iNTYwLjQ4NDM3NSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtNTgiLz4KICAgICA8dXNlIHg9IjU5NC4xNzU3ODEiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTMyIi8+CiAgICAgPHVzZSB4PSI2MjUuOTYyODkxIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy03MyIvPgogICAgIDx1c2UgeD0iNjU1LjQ1NTA3OCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTEwIi8+CiAgICAgPHVzZSB4PSI3MTguODMzOTg0IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDAiLz4KICAgICA8dXNlIHg9Ijc4Mi4zMTA1NDciIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExNyIvPgogICAgIDx1c2UgeD0iODQ1LjY4OTQ1MyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtOTkiLz4KICAgICA8dXNlIHg9IjkwMC42Njk5MjIiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTEwMSIvPgogICAgIDx1c2UgeD0iOTYyLjE5MzM1OSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTAwIi8+CiAgICAgPHVzZSB4PSIxMDI1LjY2OTkyMiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMzIiLz4KICAgICA8dXNlIHg9IjEwNTcuNDU3MDMxIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy04NCIvPgogICAgIDx1c2UgeD0iMTExOC4zMjIyNjYiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExNCIvPgogICAgIDx1c2UgeD0iMTE1OS40MzU1NDciIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTk3Ii8+CiAgICAgPHVzZSB4PSIxMjIwLjcxNDg0NCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTEwIi8+CiAgICAgPHVzZSB4PSIxMjg0LjA5Mzc1IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTUiLz4KICAgICA8dXNlIHg9IjEzMzYuMTkzMzU5IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDUiLz4KICAgICA8dXNlIHg9IjEzNjMuOTc2NTYyIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTYiLz4KICAgICA8dXNlIHg9IjE0MDMuMTg1NTQ3IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDUiLz4KICAgICA8dXNlIHg9IjE0MzAuOTY4NzUiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExMSIvPgogICAgIDx1c2UgeD0iMTQ5Mi4xNTAzOTEiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExMCIvPgogICAgIDx1c2UgeD0iMTU1NS41MjkyOTciIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTExNSIvPgogICAgPC9nPgogICA8L2c+CiAgPC9nPgogIDxnIGlkPSJheGVzXzIiPgogICA8ZyBpZD0icGF0Y2hfMyI+CiAgICA8cGF0aCBjbGlwLXBhdGg9InVybCgjcDZiNzUwNzliZjQpIiBkPSJNIDMzOC41OCAyNTIgCkwgMzM4LjU4IDI1MS4xNTA2MjUgCkwgMzM4LjU4IDM1LjQwOTM3NSAKTCAzMzguNTggMzQuNTYgCkwgMzQ5LjQ1MiAzNC41NiAKTCAzNDkuNDUyIDM1LjQwOTM3NSAKTCAzNDkuNDUyIDI1MS4xNTA2MjUgCkwgMzQ5LjQ1MiAyNTIgCnoKIiBzdHlsZT0iZmlsbDojZmZmZmZmO3N0cm9rZTojZmZmZmZmO3N0cm9rZS1saW5lam9pbjptaXRlcjtzdHJva2Utd2lkdGg6MC4wMTsiLz4KICAgPC9nPgogICA8ZyBpZD0ibWF0cGxvdGxpYi5heGlzXzMiLz4KICAgPGcgaWQ9Im1hdHBsb3RsaWIuYXhpc180Ij4KICAgIDxnIGlkPSJ5dGlja182Ij4KICAgICA8ZyBpZD0ibGluZTJkXzEiPgogICAgICA8ZGVmcz4KICAgICAgIDxwYXRoIGQ9Ik0gMCAwIApMIDMuNSAwIAoiIGlkPSJtYjVjMjBiYzQzMCIgc3R5bGU9InN0cm9rZTojMjYyNjI2O3N0cm9rZS13aWR0aDowLjg7Ii8+CiAgICAgIDwvZGVmcz4KICAgICAgPGc+CiAgICAgICA8dXNlIHN0eWxlPSJmaWxsOiMyNjI2MjY7c3Ryb2tlOiMyNjI2MjY7c3Ryb2tlLXdpZHRoOjAuODsiIHg9IjM0OS40NTIiIHhsaW5rOmhyZWY9IiNtYjVjMjBiYzQzMCIgeT0iMjUyIi8+CiAgICAgIDwvZz4KICAgICA8L2c+CiAgICAgPGcgaWQ9InRleHRfMTQiPgogICAgICA8IS0tIDAuMCAtLT4KICAgICAgPGRlZnM+CiAgICAgICA8cGF0aCBkPSJNIDMxLjc4MTI1IDY2LjQwNjI1IApRIDI0LjE3MTg3NSA2Ni40MDYyNSAyMC4zMjgxMjUgNTguOTA2MjUgClEgMTYuNSA1MS40MjE4NzUgMTYuNSAzNi4zNzUgClEgMTYuNSAyMS4zOTA2MjUgMjAuMzI4MTI1IDEzLjg5MDYyNSAKUSAyNC4xNzE4NzUgNi4zOTA2MjUgMzEuNzgxMjUgNi4zOTA2MjUgClEgMzkuNDUzMTI1IDYuMzkwNjI1IDQzLjI4MTI1IDEzLjg5MDYyNSAKUSA0Ny4xMjUgMjEuMzkwNjI1IDQ3LjEyNSAzNi4zNzUgClEgNDcuMTI1IDUxLjQyMTg3NSA0My4yODEyNSA1OC45MDYyNSAKUSAzOS40NTMxMjUgNjYuNDA2MjUgMzEuNzgxMjUgNjYuNDA2MjUgCnoKTSAzMS43ODEyNSA3NC4yMTg3NSAKUSA0NC4wNDY4NzUgNzQuMjE4NzUgNTAuNTE1NjI1IDY0LjUxNTYyNSAKUSA1Ni45ODQzNzUgNTQuODI4MTI1IDU2Ljk4NDM3NSAzNi4zNzUgClEgNTYuOTg0Mzc1IDE3Ljk2ODc1IDUwLjUxNTYyNSA4LjI2NTYyNSAKUSA0NC4wNDY4NzUgLTEuNDIxODc1IDMxLjc4MTI1IC0xLjQyMTg3NSAKUSAxOS41MzEyNSAtMS40MjE4NzUgMTMuMDYyNSA4LjI2NTYyNSAKUSA2LjU5Mzc1IDE3Ljk2ODc1IDYuNTkzNzUgMzYuMzc1IApRIDYuNTkzNzUgNTQuODI4MTI1IDEzLjA2MjUgNjQuNTE1NjI1IApRIDE5LjUzMTI1IDc0LjIxODc1IDMxLjc4MTI1IDc0LjIxODc1IAp6CiIgaWQ9IkRlamFWdVNhbnMtNDgiLz4KICAgICAgIDxwYXRoIGQ9Ik0gMTAuNjg3NSAxMi40MDYyNSAKTCAyMSAxMi40MDYyNSAKTCAyMSAwIApMIDEwLjY4NzUgMCAKegoiIGlkPSJEZWphVnVTYW5zLTQ2Ii8+CiAgICAgIDwvZGVmcz4KICAgICAgPGcgc3R5bGU9ImZpbGw6IzI2MjYyNjsiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDM1Ni40NTIgMjU1Ljc5OTIxOSlzY2FsZSgwLjEgLTAuMSkiPgogICAgICAgPHVzZSB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy00OCIvPgogICAgICAgPHVzZSB4PSI2My42MjMwNDciIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTQ2Ii8+CiAgICAgICA8dXNlIHg9Ijk1LjQxMDE1NiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtNDgiLz4KICAgICAgPC9nPgogICAgIDwvZz4KICAgIDwvZz4KICAgIDxnIGlkPSJ5dGlja183Ij4KICAgICA8ZyBpZD0ibGluZTJkXzIiPgogICAgICA8Zz4KICAgICAgIDx1c2Ugc3R5bGU9ImZpbGw6IzI2MjYyNjtzdHJva2U6IzI2MjYyNjtzdHJva2Utd2lkdGg6MC44OyIgeD0iMzQ5LjQ1MiIgeGxpbms6aHJlZj0iI21iNWMyMGJjNDMwIiB5PSIyMTUuNzYiLz4KICAgICAgPC9nPgogICAgIDwvZz4KICAgICA8ZyBpZD0idGV4dF8xNSI+CiAgICAgIDwhLS0gMC4xIC0tPgogICAgICA8ZyBzdHlsZT0iZmlsbDojMjYyNjI2OyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMzU2LjQ1MiAyMTkuNTU5MjE5KXNjYWxlKDAuMSAtMC4xKSI+CiAgICAgICA8dXNlIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTQ4Ii8+CiAgICAgICA8dXNlIHg9IjYzLjYyMzA0NyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtNDYiLz4KICAgICAgIDx1c2UgeD0iOTUuNDEwMTU2IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy00OSIvPgogICAgICA8L2c+CiAgICAgPC9nPgogICAgPC9nPgogICAgPGcgaWQ9Inl0aWNrXzgiPgogICAgIDxnIGlkPSJsaW5lMmRfMyI+CiAgICAgIDxnPgogICAgICAgPHVzZSBzdHlsZT0iZmlsbDojMjYyNjI2O3N0cm9rZTojMjYyNjI2O3N0cm9rZS13aWR0aDowLjg7IiB4PSIzNDkuNDUyIiB4bGluazpocmVmPSIjbWI1YzIwYmM0MzAiIHk9IjE3OS41MiIvPgogICAgICA8L2c+CiAgICAgPC9nPgogICAgIDxnIGlkPSJ0ZXh0XzE2Ij4KICAgICAgPCEtLSAwLjIgLS0+CiAgICAgIDxkZWZzPgogICAgICAgPHBhdGggZD0iTSAxOS4xODc1IDguMjk2ODc1IApMIDUzLjYwOTM3NSA4LjI5Njg3NSAKTCA1My42MDkzNzUgMCAKTCA3LjMyODEyNSAwIApMIDcuMzI4MTI1IDguMjk2ODc1IApRIDEyLjkzNzUgMTQuMTA5Mzc1IDIyLjYyNSAyMy44OTA2MjUgClEgMzIuMzI4MTI1IDMzLjY4NzUgMzQuODEyNSAzNi41MzEyNSAKUSAzOS41NDY4NzUgNDEuODQzNzUgNDEuNDIxODc1IDQ1LjUzMTI1IApRIDQzLjMxMjUgNDkuMjE4NzUgNDMuMzEyNSA1Mi43ODEyNSAKUSA0My4zMTI1IDU4LjU5Mzc1IDM5LjIzNDM3NSA2Mi4yNSAKUSAzNS4xNTYyNSA2NS45MjE4NzUgMjguNjA5Mzc1IDY1LjkyMTg3NSAKUSAyMy45Njg3NSA2NS45MjE4NzUgMTguODEyNSA2NC4zMTI1IApRIDEzLjY3MTg3NSA2Mi43MDMxMjUgNy44MTI1IDU5LjQyMTg3NSAKTCA3LjgxMjUgNjkuMzkwNjI1IApRIDEzLjc2NTYyNSA3MS43ODEyNSAxOC45Mzc1IDczIApRIDI0LjEyNSA3NC4yMTg3NSAyOC40MjE4NzUgNzQuMjE4NzUgClEgMzkuNzUgNzQuMjE4NzUgNDYuNDg0Mzc1IDY4LjU0Njg3NSAKUSA1My4yMTg3NSA2Mi44OTA2MjUgNTMuMjE4NzUgNTMuNDIxODc1IApRIDUzLjIxODc1IDQ4LjkyMTg3NSA1MS41MzEyNSA0NC44OTA2MjUgClEgNDkuODU5Mzc1IDQwLjg3NSA0NS40MDYyNSAzNS40MDYyNSAKUSA0NC4xODc1IDMzLjk4NDM3NSAzNy42NDA2MjUgMjcuMjE4NzUgClEgMzEuMTA5Mzc1IDIwLjQ1MzEyNSAxOS4xODc1IDguMjk2ODc1IAp6CiIgaWQ9IkRlamFWdVNhbnMtNTAiLz4KICAgICAgPC9kZWZzPgogICAgICA8ZyBzdHlsZT0iZmlsbDojMjYyNjI2OyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMzU2LjQ1MiAxODMuMzE5MjE5KXNjYWxlKDAuMSAtMC4xKSI+CiAgICAgICA8dXNlIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTQ4Ii8+CiAgICAgICA8dXNlIHg9IjYzLjYyMzA0NyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtNDYiLz4KICAgICAgIDx1c2UgeD0iOTUuNDEwMTU2IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy01MCIvPgogICAgICA8L2c+CiAgICAgPC9nPgogICAgPC9nPgogICAgPGcgaWQ9Inl0aWNrXzkiPgogICAgIDxnIGlkPSJsaW5lMmRfNCI+CiAgICAgIDxnPgogICAgICAgPHVzZSBzdHlsZT0iZmlsbDojMjYyNjI2O3N0cm9rZTojMjYyNjI2O3N0cm9rZS13aWR0aDowLjg7IiB4PSIzNDkuNDUyIiB4bGluazpocmVmPSIjbWI1YzIwYmM0MzAiIHk9IjE0My4yOCIvPgogICAgICA8L2c+CiAgICAgPC9nPgogICAgIDxnIGlkPSJ0ZXh0XzE3Ij4KICAgICAgPCEtLSAwLjMgLS0+CiAgICAgIDxkZWZzPgogICAgICAgPHBhdGggZD0iTSA0MC41NzgxMjUgMzkuMzEyNSAKUSA0Ny42NTYyNSAzNy43OTY4NzUgNTEuNjI1IDMzIApRIDU1LjYwOTM3NSAyOC4yMTg3NSA1NS42MDkzNzUgMjEuMTg3NSAKUSA1NS42MDkzNzUgMTAuNDA2MjUgNDguMTg3NSA0LjQ4NDM3NSAKUSA0MC43NjU2MjUgLTEuNDIxODc1IDI3LjA5Mzc1IC0xLjQyMTg3NSAKUSAyMi41MTU2MjUgLTEuNDIxODc1IDE3LjY1NjI1IC0wLjUxNTYyNSAKUSAxMi43OTY4NzUgMC4zOTA2MjUgNy42MjUgMi4yMDMxMjUgCkwgNy42MjUgMTEuNzE4NzUgClEgMTEuNzE4NzUgOS4zMjgxMjUgMTYuNTkzNzUgOC4xMDkzNzUgClEgMjEuNDg0Mzc1IDYuODkwNjI1IDI2LjgxMjUgNi44OTA2MjUgClEgMzYuMDc4MTI1IDYuODkwNjI1IDQwLjkzNzUgMTAuNTQ2ODc1IApRIDQ1Ljc5Njg3NSAxNC4yMDMxMjUgNDUuNzk2ODc1IDIxLjE4NzUgClEgNDUuNzk2ODc1IDI3LjY0MDYyNSA0MS4yODEyNSAzMS4yNjU2MjUgClEgMzYuNzY1NjI1IDM0LjkwNjI1IDI4LjcxODc1IDM0LjkwNjI1IApMIDIwLjIxODc1IDM0LjkwNjI1IApMIDIwLjIxODc1IDQzLjAxNTYyNSAKTCAyOS4xMDkzNzUgNDMuMDE1NjI1IApRIDM2LjM3NSA0My4wMTU2MjUgNDAuMjM0Mzc1IDQ1LjkyMTg3NSAKUSA0NC4wOTM3NSA0OC44MjgxMjUgNDQuMDkzNzUgNTQuMjk2ODc1IApRIDQ0LjA5Mzc1IDU5LjkwNjI1IDQwLjEwOTM3NSA2Mi45MDYyNSAKUSAzNi4xNDA2MjUgNjUuOTIxODc1IDI4LjcxODc1IDY1LjkyMTg3NSAKUSAyNC42NTYyNSA2NS45MjE4NzUgMjAuMDE1NjI1IDY1LjAzMTI1IApRIDE1LjM3NSA2NC4xNTYyNSA5LjgxMjUgNjIuMzEyNSAKTCA5LjgxMjUgNzEuMDkzNzUgClEgMTUuNDM3NSA3Mi42NTYyNSAyMC4zNDM3NSA3My40Mzc1IApRIDI1LjI1IDc0LjIxODc1IDI5LjU5Mzc1IDc0LjIxODc1IApRIDQwLjgyODEyNSA3NC4yMTg3NSA0Ny4zNTkzNzUgNjkuMTA5Mzc1IApRIDUzLjkwNjI1IDY0LjAxNTYyNSA1My45MDYyNSA1NS4zMjgxMjUgClEgNTMuOTA2MjUgNDkuMjY1NjI1IDUwLjQzNzUgNDUuMDkzNzUgClEgNDYuOTY4NzUgNDAuOTIxODc1IDQwLjU3ODEyNSAzOS4zMTI1IAp6CiIgaWQ9IkRlamFWdVNhbnMtNTEiLz4KICAgICAgPC9kZWZzPgogICAgICA8ZyBzdHlsZT0iZmlsbDojMjYyNjI2OyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMzU2LjQ1MiAxNDcuMDc5MjE5KXNjYWxlKDAuMSAtMC4xKSI+CiAgICAgICA8dXNlIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTQ4Ii8+CiAgICAgICA8dXNlIHg9IjYzLjYyMzA0NyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtNDYiLz4KICAgICAgIDx1c2UgeD0iOTUuNDEwMTU2IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy01MSIvPgogICAgICA8L2c+CiAgICAgPC9nPgogICAgPC9nPgogICAgPGcgaWQ9Inl0aWNrXzEwIj4KICAgICA8ZyBpZD0ibGluZTJkXzUiPgogICAgICA8Zz4KICAgICAgIDx1c2Ugc3R5bGU9ImZpbGw6IzI2MjYyNjtzdHJva2U6IzI2MjYyNjtzdHJva2Utd2lkdGg6MC44OyIgeD0iMzQ5LjQ1MiIgeGxpbms6aHJlZj0iI21iNWMyMGJjNDMwIiB5PSIxMDcuMDQiLz4KICAgICAgPC9nPgogICAgIDwvZz4KICAgICA8ZyBpZD0idGV4dF8xOCI+CiAgICAgIDwhLS0gMC40IC0tPgogICAgICA8ZGVmcz4KICAgICAgIDxwYXRoIGQ9Ik0gMzcuNzk2ODc1IDY0LjMxMjUgCkwgMTIuODkwNjI1IDI1LjM5MDYyNSAKTCAzNy43OTY4NzUgMjUuMzkwNjI1IAp6Ck0gMzUuMjAzMTI1IDcyLjkwNjI1IApMIDQ3LjYwOTM3NSA3Mi45MDYyNSAKTCA0Ny42MDkzNzUgMjUuMzkwNjI1IApMIDU4LjAxNTYyNSAyNS4zOTA2MjUgCkwgNTguMDE1NjI1IDE3LjE4NzUgCkwgNDcuNjA5Mzc1IDE3LjE4NzUgCkwgNDcuNjA5Mzc1IDAgCkwgMzcuNzk2ODc1IDAgCkwgMzcuNzk2ODc1IDE3LjE4NzUgCkwgNC44OTA2MjUgMTcuMTg3NSAKTCA0Ljg5MDYyNSAyNi43MDMxMjUgCnoKIiBpZD0iRGVqYVZ1U2Fucy01MiIvPgogICAgICA8L2RlZnM+CiAgICAgIDxnIHN0eWxlPSJmaWxsOiMyNjI2MjY7IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzNTYuNDUyIDExMC44MzkyMTkpc2NhbGUoMC4xIC0wLjEpIj4KICAgICAgIDx1c2UgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtNDgiLz4KICAgICAgIDx1c2UgeD0iNjMuNjIzMDQ3IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy00NiIvPgogICAgICAgPHVzZSB4PSI5NS40MTAxNTYiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTUyIi8+CiAgICAgIDwvZz4KICAgICA8L2c+CiAgICA8L2c+CiAgICA8ZyBpZD0ieXRpY2tfMTEiPgogICAgIDxnIGlkPSJsaW5lMmRfNiI+CiAgICAgIDxnPgogICAgICAgPHVzZSBzdHlsZT0iZmlsbDojMjYyNjI2O3N0cm9rZTojMjYyNjI2O3N0cm9rZS13aWR0aDowLjg7IiB4PSIzNDkuNDUyIiB4bGluazpocmVmPSIjbWI1YzIwYmM0MzAiIHk9IjcwLjgiLz4KICAgICAgPC9nPgogICAgIDwvZz4KICAgICA8ZyBpZD0idGV4dF8xOSI+CiAgICAgIDwhLS0gMC41IC0tPgogICAgICA8ZGVmcz4KICAgICAgIDxwYXRoIGQ9Ik0gMTAuNzk2ODc1IDcyLjkwNjI1IApMIDQ5LjUxNTYyNSA3Mi45MDYyNSAKTCA0OS41MTU2MjUgNjQuNTkzNzUgCkwgMTkuODI4MTI1IDY0LjU5Mzc1IApMIDE5LjgyODEyNSA0Ni43MzQzNzUgClEgMjEuOTY4NzUgNDcuNDY4NzUgMjQuMTA5Mzc1IDQ3LjgyODEyNSAKUSAyNi4yNjU2MjUgNDguMTg3NSAyOC40MjE4NzUgNDguMTg3NSAKUSA0MC42MjUgNDguMTg3NSA0Ny43NSA0MS41IApRIDU0Ljg5MDYyNSAzNC44MTI1IDU0Ljg5MDYyNSAyMy4zOTA2MjUgClEgNTQuODkwNjI1IDExLjYyNSA0Ny41NjI1IDUuMDkzNzUgClEgNDAuMjM0Mzc1IC0xLjQyMTg3NSAyNi45MDYyNSAtMS40MjE4NzUgClEgMjIuMzEyNSAtMS40MjE4NzUgMTcuNTQ2ODc1IC0wLjY0MDYyNSAKUSAxMi43OTY4NzUgMC4xNDA2MjUgNy43MTg3NSAxLjcwMzEyNSAKTCA3LjcxODc1IDExLjYyNSAKUSAxMi4xMDkzNzUgOS4yMzQzNzUgMTYuNzk2ODc1IDguMDYyNSAKUSAyMS40ODQzNzUgNi44OTA2MjUgMjYuNzAzMTI1IDYuODkwNjI1IApRIDM1LjE1NjI1IDYuODkwNjI1IDQwLjA3ODEyNSAxMS4zMjgxMjUgClEgNDUuMDE1NjI1IDE1Ljc2NTYyNSA0NS4wMTU2MjUgMjMuMzkwNjI1IApRIDQ1LjAxNTYyNSAzMSA0MC4wNzgxMjUgMzUuNDM3NSAKUSAzNS4xNTYyNSAzOS44OTA2MjUgMjYuNzAzMTI1IDM5Ljg5MDYyNSAKUSAyMi43NSAzOS44OTA2MjUgMTguODEyNSAzOS4wMTU2MjUgClEgMTQuODkwNjI1IDM4LjE0MDYyNSAxMC43OTY4NzUgMzYuMjgxMjUgCnoKIiBpZD0iRGVqYVZ1U2Fucy01MyIvPgogICAgICA8L2RlZnM+CiAgICAgIDxnIHN0eWxlPSJmaWxsOiMyNjI2MjY7IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzNTYuNDUyIDc0LjU5OTIxOSlzY2FsZSgwLjEgLTAuMSkiPgogICAgICAgPHVzZSB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy00OCIvPgogICAgICAgPHVzZSB4PSI2My42MjMwNDciIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTQ2Ii8+CiAgICAgICA8dXNlIHg9Ijk1LjQxMDE1NiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtNTMiLz4KICAgICAgPC9nPgogICAgIDwvZz4KICAgIDwvZz4KICAgIDxnIGlkPSJ5dGlja18xMiI+CiAgICAgPGcgaWQ9ImxpbmUyZF83Ij4KICAgICAgPGc+CiAgICAgICA8dXNlIHN0eWxlPSJmaWxsOiMyNjI2MjY7c3Ryb2tlOiMyNjI2MjY7c3Ryb2tlLXdpZHRoOjAuODsiIHg9IjM0OS40NTIiIHhsaW5rOmhyZWY9IiNtYjVjMjBiYzQzMCIgeT0iMzQuNTYiLz4KICAgICAgPC9nPgogICAgIDwvZz4KICAgICA8ZyBpZD0idGV4dF8yMCI+CiAgICAgIDwhLS0gMC42IC0tPgogICAgICA8ZGVmcz4KICAgICAgIDxwYXRoIGQ9Ik0gMzMuMDE1NjI1IDQwLjM3NSAKUSAyNi4zNzUgNDAuMzc1IDIyLjQ4NDM3NSAzNS44MjgxMjUgClEgMTguNjA5Mzc1IDMxLjI5Njg3NSAxOC42MDkzNzUgMjMuMzkwNjI1IApRIDE4LjYwOTM3NSAxNS41MzEyNSAyMi40ODQzNzUgMTAuOTUzMTI1IApRIDI2LjM3NSA2LjM5MDYyNSAzMy4wMTU2MjUgNi4zOTA2MjUgClEgMzkuNjU2MjUgNi4zOTA2MjUgNDMuNTMxMjUgMTAuOTUzMTI1IApRIDQ3LjQwNjI1IDE1LjUzMTI1IDQ3LjQwNjI1IDIzLjM5MDYyNSAKUSA0Ny40MDYyNSAzMS4yOTY4NzUgNDMuNTMxMjUgMzUuODI4MTI1IApRIDM5LjY1NjI1IDQwLjM3NSAzMy4wMTU2MjUgNDAuMzc1IAp6Ck0gNTIuNTkzNzUgNzEuMjk2ODc1IApMIDUyLjU5Mzc1IDYyLjMxMjUgClEgNDguODc1IDY0LjA2MjUgNDUuMDkzNzUgNjQuOTg0Mzc1IApRIDQxLjMxMjUgNjUuOTIxODc1IDM3LjU5Mzc1IDY1LjkyMTg3NSAKUSAyNy44MjgxMjUgNjUuOTIxODc1IDIyLjY3MTg3NSA1OS4zMjgxMjUgClEgMTcuNTMxMjUgNTIuNzM0Mzc1IDE2Ljc5Njg3NSAzOS40MDYyNSAKUSAxOS42NzE4NzUgNDMuNjU2MjUgMjQuMDE1NjI1IDQ1LjkyMTg3NSAKUSAyOC4zNzUgNDguMTg3NSAzMy41OTM3NSA0OC4xODc1IApRIDQ0LjU3ODEyNSA0OC4xODc1IDUwLjk1MzEyNSA0MS41MTU2MjUgClEgNTcuMzI4MTI1IDM0Ljg1OTM3NSA1Ny4zMjgxMjUgMjMuMzkwNjI1IApRIDU3LjMyODEyNSAxMi4xNTYyNSA1MC42ODc1IDUuMzU5Mzc1IApRIDQ0LjA0Njg3NSAtMS40MjE4NzUgMzMuMDE1NjI1IC0xLjQyMTg3NSAKUSAyMC4zNTkzNzUgLTEuNDIxODc1IDEzLjY3MTg3NSA4LjI2NTYyNSAKUSA2Ljk4NDM3NSAxNy45Njg3NSA2Ljk4NDM3NSAzNi4zNzUgClEgNi45ODQzNzUgNTMuNjU2MjUgMTUuMTg3NSA2My45Mzc1IApRIDIzLjM5MDYyNSA3NC4yMTg3NSAzNy4yMDMxMjUgNzQuMjE4NzUgClEgNDAuOTIxODc1IDc0LjIxODc1IDQ0LjcwMzEyNSA3My40ODQzNzUgClEgNDguNDg0Mzc1IDcyLjc1IDUyLjU5Mzc1IDcxLjI5Njg3NSAKegoiIGlkPSJEZWphVnVTYW5zLTU0Ii8+CiAgICAgIDwvZGVmcz4KICAgICAgPGcgc3R5bGU9ImZpbGw6IzI2MjYyNjsiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDM1Ni40NTIgMzguMzU5MjE5KXNjYWxlKDAuMSAtMC4xKSI+CiAgICAgICA8dXNlIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTQ4Ii8+CiAgICAgICA8dXNlIHg9IjYzLjYyMzA0NyIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtNDYiLz4KICAgICAgIDx1c2UgeD0iOTUuNDEwMTU2IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy01NCIvPgogICAgICA8L2c+CiAgICAgPC9nPgogICAgPC9nPgogICAgPGcgaWQ9InRleHRfMjEiPgogICAgIDwhLS0gVHJhbnNpdGlvbiBQcm9iYWJpbGl0eSAtLT4KICAgICA8ZGVmcz4KICAgICAgPHBhdGggZD0iTSA0OC42ODc1IDI3LjI5Njg3NSAKUSA0OC42ODc1IDM3LjIwMzEyNSA0NC42MDkzNzUgNDIuODQzNzUgClEgNDAuNTMxMjUgNDguNDg0Mzc1IDMzLjQwNjI1IDQ4LjQ4NDM3NSAKUSAyNi4yNjU2MjUgNDguNDg0Mzc1IDIyLjE4NzUgNDIuODQzNzUgClEgMTguMTA5Mzc1IDM3LjIwMzEyNSAxOC4xMDkzNzUgMjcuMjk2ODc1IApRIDE4LjEwOTM3NSAxNy4zOTA2MjUgMjIuMTg3NSAxMS43NSAKUSAyNi4yNjU2MjUgNi4xMDkzNzUgMzMuNDA2MjUgNi4xMDkzNzUgClEgNDAuNTMxMjUgNi4xMDkzNzUgNDQuNjA5Mzc1IDExLjc1IApRIDQ4LjY4NzUgMTcuMzkwNjI1IDQ4LjY4NzUgMjcuMjk2ODc1IAp6Ck0gMTguMTA5Mzc1IDQ2LjM5MDYyNSAKUSAyMC45NTMxMjUgNTEuMjY1NjI1IDI1LjI2NTYyNSA1My42MjUgClEgMjkuNTkzNzUgNTYgMzUuNTkzNzUgNTYgClEgNDUuNTYyNSA1NiA1MS43ODEyNSA0OC4wOTM3NSAKUSA1OC4wMTU2MjUgNDAuMTg3NSA1OC4wMTU2MjUgMjcuMjk2ODc1IApRIDU4LjAxNTYyNSAxNC40MDYyNSA1MS43ODEyNSA2LjQ4NDM3NSAKUSA0NS41NjI1IC0xLjQyMTg3NSAzNS41OTM3NSAtMS40MjE4NzUgClEgMjkuNTkzNzUgLTEuNDIxODc1IDI1LjI2NTYyNSAwLjk1MzEyNSAKUSAyMC45NTMxMjUgMy4zMjgxMjUgMTguMTA5Mzc1IDguMjAzMTI1IApMIDE4LjEwOTM3NSAwIApMIDkuMDc4MTI1IDAgCkwgOS4wNzgxMjUgNzUuOTg0Mzc1IApMIDE4LjEwOTM3NSA3NS45ODQzNzUgCnoKIiBpZD0iRGVqYVZ1U2Fucy05OCIvPgogICAgIDwvZGVmcz4KICAgICA8ZyBzdHlsZT0iZmlsbDojMjYyNjI2OyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMzgzLjk1MzU2MyAxOTYuMzk3OTY5KXJvdGF0ZSgtOTApc2NhbGUoMC4xIC0wLjEpIj4KICAgICAgPHVzZSB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy04NCIvPgogICAgICA8dXNlIHg9IjYwLjg2NTIzNCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTE0Ii8+CiAgICAgIDx1c2UgeD0iMTAxLjk3ODUxNiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtOTciLz4KICAgICAgPHVzZSB4PSIxNjMuMjU3ODEyIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTAiLz4KICAgICAgPHVzZSB4PSIyMjYuNjM2NzE5IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTUiLz4KICAgICAgPHVzZSB4PSIyNzguNzM2MzI4IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDUiLz4KICAgICAgPHVzZSB4PSIzMDYuNTE5NTMxIiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTYiLz4KICAgICAgPHVzZSB4PSIzNDUuNzI4NTE2IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMDUiLz4KICAgICAgPHVzZSB4PSIzNzMuNTExNzE5IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTEiLz4KICAgICAgPHVzZSB4PSI0MzQuNjkzMzU5IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0xMTAiLz4KICAgICAgPHVzZSB4PSI0OTguMDcyMjY2IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy0zMiIvPgogICAgICA8dXNlIHg9IjUyOS44NTkzNzUiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTgwIi8+CiAgICAgIDx1c2UgeD0iNTkwLjE0NjQ4NCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTE0Ii8+CiAgICAgIDx1c2UgeD0iNjMxLjIyODUxNiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTExIi8+CiAgICAgIDx1c2UgeD0iNjkyLjQxMDE1NiIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtOTgiLz4KICAgICAgPHVzZSB4PSI3NTUuODg2NzE5IiB4bGluazpocmVmPSIjRGVqYVZ1U2Fucy05NyIvPgogICAgICA8dXNlIHg9IjgxNy4xNjYwMTYiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTk4Ii8+CiAgICAgIDx1c2UgeD0iODgwLjY0MjU3OCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTA1Ii8+CiAgICAgIDx1c2UgeD0iOTA4LjQyNTc4MSIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTA4Ii8+CiAgICAgIDx1c2UgeD0iOTM2LjIwODk4NCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTA1Ii8+CiAgICAgIDx1c2UgeD0iOTYzLjk5MjE4OCIgeGxpbms6aHJlZj0iI0RlamFWdVNhbnMtMTE2Ii8+CiAgICAgIDx1c2UgeD0iMTAwMy4yMDExNzIiIHhsaW5rOmhyZWY9IiNEZWphVnVTYW5zLTEyMSIvPgogICAgIDwvZz4KICAgIDwvZz4KICAgPC9nPgogICA8aW1hZ2UgaGVpZ2h0PSIyMTciIGlkPSJpbWFnZWMwYmZiYTU4MmYiIHRyYW5zZm9ybT0ic2NhbGUoMSAtMSl0cmFuc2xhdGUoMCAtMjE3KSIgd2lkdGg9IjEwIiB4PSIzMzkiIHhsaW5rOmhyZWY9ImRhdGE6aW1hZ2UvcG5nO2Jhc2U2NCwKaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUFvQUFBRFpDQVlBQUFBWm1LRThBQUFBQkhOQ1NWUUlDQWdJZkFoa2lBQUFBT2hKUkVGVWFJSGxsdEVOZzBBTVEwUEYvaFBTU1ZydXVvSXIyWHBLNEJ2aHk3Tjk0WGhmMXk3aE9ZK1MzcXVYOUZaVm5jZGU3aStLWndTbC9YZ2kwcU9Hc1h2dHgxTWluc0tjYWRGQ0RrOGdGQlVJTHVaMVloZ0tlSXNXcW1lTVNEZndlbUZlYzNnQzB1UXdvb1hrK2tnQUIvR01Hb1piSDZ0QnpERGdrV0hjd1Bja3J6ZTRDeHYwV3NlRHhjeGZoVWpNc0orNDNTQzRBVHpxSmVXWFZqc1RDSzYvTTJSd0d6aWpscXRGWnpqZ1BielcxOGVnWVRqcGh3WjMzWU9HNGI3WUlyZ0pyeCtJcDhmNlVJZmhRb0VHOTU1MDQ4cGVmKzNTSHpzZThZeWc5RDk0M0wzbThQd0FVUm96bk9oMFErNEFBQUFBU1VWT1JLNUNZSUk9IiB5PSItMzUiLz4KICAgPGcgaWQ9InBhdGNoXzQiPgogICAgPHBhdGggZD0iTSAzMzguNTggMjUyIApMIDMzOC41OCAyNTEuMTUwNjI1IApMIDMzOC41OCAzNS40MDkzNzUgCkwgMzM4LjU4IDM0LjU2IApMIDM0OS40NTIgMzQuNTYgCkwgMzQ5LjQ1MiAzNS40MDkzNzUgCkwgMzQ5LjQ1MiAyNTEuMTUwNjI1IApMIDM0OS40NTIgMjUyIAp6CiIgc3R5bGU9ImZpbGw6bm9uZTsiLz4KICAgPC9nPgogIDwvZz4KIDwvZz4KIDxkZWZzPgogIDxjbGlwUGF0aCBpZD0icGZkYjlkOGM1OGIiPgogICA8cmVjdCBoZWlnaHQ9IjIxNy40NCIgd2lkdGg9IjI2Ny44NCIgeD0iNTQiIHk9IjM0LjU2Ii8+CiAgPC9jbGlwUGF0aD4KICA8Y2xpcFBhdGggaWQ9InA2Yjc1MDc5YmY0Ij4KICAgPHJlY3QgaGVpZ2h0PSIyMTcuNDQiIHdpZHRoPSIxMC44NzIiIHg9IjMzOC41OCIgeT0iMzQuNTYiLz4KICA8L2NsaXBQYXRoPgogPC9kZWZzPgo8L3N2Zz4K'} height="400" width="400" />
                        </Grid>
      
                        <Grid item >
                            <Typography component="h6" variant="h6" style={{ width: '100%', textAlign: 'center', margin: 16 }}>
                                Personal Map
                            </Typography>
                            <img src={'data:image/svg+xml;base64,' + visualizations.heatmap} height="400" width="400" />                               
                        </Grid>
                    </Grid> 
                </Card>
            }

            {(state.attachments || []).map(attachment =>
                <Card key={attachment} style={{ padding: '.3rem' }}>
                    { /* eslint-disable-next-line */ }
                    <img src={'data:image/png;base64,' + attachment} />
                    {/*
                    <Document
                        file={'data:application/pdf;base64,' + attachment}
                        error={
                            <Typography variant="body1" color="error">
                                Visualization error occurred.
                            </Typography>
                        }
                        loading="">
                        <Page renderMode="svg" pageIndex={0}/>
                    </Document>*/}
                </Card>
            )}
            <Box display="flex" p={4} justifyContent="center">
                <MenuButton 
                    style={{ margin: 'auto 0' }}
                    title="Administer Survey Instruments" 
                    icon={<Icon>assignment</Icon>}
                    items={(state.activities || []).filter(x => x.spec === 'lamp.survey' && (_shouldRestrict() ? x.name.includes('SELF REPORT') : true)).map(x => x.name)} 
                    onAction={() => setActivities((state.activities || []).filter(x => x.spec === 'lamp.survey' && (_shouldRestrict() ? x.name.includes('SELF REPORT') : true)))}
                    onClick={y => setActivities((state.activities || []).filter(x => x.spec === 'lamp.survey' && (_shouldRestrict() ? x.name.includes('SELF REPORT') : true) && x.name === y))}
                />
            </Box>
            <Dialog
                fullScreen
                open={!!survey}
                onClose={() => setSurvey()}
                TransitionComponent={SlideUp}
            >
                <IconButton 
                    style={{ 
                        position: 'fixed', 
                        left: 16, 
                        top: 16, 
                        background: '#ffffff66', 
                        WebkitBackdropFilter: 'blur(5px)' 
                    }} 
                    color="inherit" 
                    onClick={() => setSurvey()} 
                    aria-label="Close"
                >
                    <Icon>close</Icon>
                </IconButton>
                <Box py={8} px={2}>
                    <Survey
                        validate
                        partialValidationOnly
                        content={survey} 
                        prefillData={!!survey ? survey.prefillData : undefined}
                        prefillTimestamp={!!survey ? survey.prefillTimestamp : undefined}
                        onValidationFailure={() => props.layout.showAlert('Some responses are missing. Please complete all questions before submitting.')}
                        onResponse={submitSurvey} 
                    />
                </Box>
            </Dialog>
        </React.Fragment>
    )
}
