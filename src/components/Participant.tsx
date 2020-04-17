// Core Imports
import React, { useState, useEffect } from "react"
import {
  Box,
  Card,
  Switch,
  Typography,
  Divider,
  Grid,
  Fab,
  Drawer,
  Icon,
  useTheme,
  useMediaQuery,
  Tooltip,
  BottomNavigationAction,
} from "@material-ui/core"
import { blue } from "@material-ui/core/colors"
import { useSnackbar } from "notistack"

// Local Imports
import LAMP from "lamp-core"
import ActivityCard from "./ActivityCard"
import MultipleSelect from "./MultipleSelect"
import CareTeam from "./CareTeam"
import Messages from "./Messages"
import Launcher from "./Launcher"
import Sparkline from "./Sparkline"
import MultiPieChart from "./MultiPieChart"
import Survey from "./Survey"
import ResponsiveDialog from "./ResponsiveDialog"
import Breathe from "./Breathe"
import Jewels from "./Jewels"
import { spliceActivity } from "./ActivityList"
import Journal from "./Journal"
import Resources from "./Resources"
import MoodTips from "./MoodTips"
import SleepTips from "./SleepTips"
import SocialTips from "./SocialTips"
import Hopebox from "./Hopebox"
import BookRecommendations from "./BookRecommendations"
import Definitions from "./Definitions"
import { ReactComponent as Books } from "../icons/Books.svg"
import { ReactComponent as Mood } from "../icons/Mood.svg"
import { ReactComponent as Sleep } from "../icons/Sleep.svg"
import { ReactComponent as MentalHealth } from "../icons/MentalHealth.svg"
import { ReactComponent as Information } from "../icons/Information.svg"
import { ReactComponent as Social } from "../icons/Social.svg"
import { ReactComponent as Surveys } from "../icons/Surveys.svg"
import { ReactComponent as Hope } from "../icons/Hope.svg"
import { ReactComponent as BreatheIcon } from "../icons/Breathe.svg"
import { ReactComponent as JournalIcon } from "../icons/Journal.svg"
import { ReactComponent as JewelsIcon } from "../icons/Jewels.svg"

function _hideCareTeam() {
  return (LAMP.Auth._auth.serverAddress || "").includes(".psych.digital")
}
function _patientMode() {
  return LAMP.Auth._type === "participant"
}
function _shouldRestrict() {
  return _patientMode() && _hideCareTeam()
}

// TODO: all SensorEvents?

export default function Participant({ participant, ...props }) {
  const [state, setState] = useState<any>({})
  const [activities, setActivities] = useState([])
  const [visualizations, setVisualizations] = useState({})
  const [survey, setSurvey] = useState<any>()
  const [submission, setSubmission] = useState(0)
  const [hiddenEvents, setHiddenEvents] = useState([])
  const [launchedActivity, setLaunchedActivity] = useState<string>()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { enqueueSnackbar } = useSnackbar()
  const [tab, setTab] = useState("prevent")

  const supportsSidebar = useMediaQuery(useTheme().breakpoints.up("md"))
  useEffect(() => {
    setSidebarOpen(false)
  }, [survey])

  useEffect(() => {
    ;(async () => {
      let visualizations = {}
      for (let attachmentID of ((await LAMP.Type.listAttachments(participant.id)) as any).data) {
        if (!attachmentID.startsWith("lamp.dashboard.experimental")) continue
        let bstr = ((await LAMP.Type.getAttachment(participant.id, attachmentID)) as any).data
        visualizations[attachmentID] = bstr.startsWith("data:") ? bstr : `data:image/svg+xml;base64,${bstr}` // defaults
      }
      setVisualizations(visualizations)
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      // Refresh hidden events list.
      let _hidden = (await LAMP.Type.getAttachment(participant.id, "lamp.dashboard.hidden_events")) as any
      _hidden = !!_hidden.error ? [] : _hidden.data
      setHiddenEvents(_hidden)

      // Perform event coalescing/grouping by sensor or activity type.
      let _activities = await LAMP.Activity.allByParticipant(participant.id)
      let _state = {
        ...state,
        activities: _activities,
        activity_events: (await LAMP.ActivityEvent.allByParticipant(participant.id))
          .map((x) => ({
            ...x,
            activity: _activities.find(
              (y) =>
                x.activity === y.id ||
                (!!x.static_data.survey_name && x.static_data.survey_name.toLowerCase() === y.name.toLowerCase())
            ),
          }))
          .filter((x) => (!!x.activity ? !_hidden.includes(`${x.timestamp}/${x.activity.id}`) : true))
          .sort((x, y) => x.timestamp - y.timestamp)
          .map((x) => ({
            ...x,
            activity: (x.activity || { name: "" }).name,
            activity_spec: (x.activity || { spec: "" }).spec || "",
          }))
          .groupBy("activity"),
        sensor_events: ((await LAMP.SensorEvent.allByParticipant(participant.id)) as any).groupBy("sensor"),
      }

      // Perform datetime coalescing to either days or weeks.
      _state.sensor_events["lamp.steps"] = Object.values(
        ((_state.sensor_events || {})["lamp.steps"] || [])
          .map((x) => ({
            ...x,
            timestamp: Math.round(x.timestamp / (24 * 60 * 60 * 1000)) /* days */,
          }))
          .groupBy("timestamp")
      )
        .map((x: any[]) =>
          x.reduce(
            (a, b) =>
              !!a.timestamp
                ? {
                    ...a,
                    data: {
                      value: a.data.value + b.data.value,
                      units: "steps",
                    },
                  }
                : b,
            {}
          )
        )
        .map((x) => ({
          ...x,
          timestamp: x.timestamp * (24 * 60 * 60 * 1000) /* days */,
        }))

      // Perform count coalescing on processed events grouped by type.
      setState({
        ..._state,
        activity_counts: Object.assign(
          {},
          ...Object.entries(_state.activity_events || {}).map(([k, v]: [string, any[]]) => ({
            [k]: v.length,
          }))
        ),
        sensor_counts: {
          "Environmental Context": ((_state.sensor_events || {})["lamp.gps.contextual"] || []).length,
          "Step Count": ((_state.sensor_events || {})["lamp.steps"] || []).length,
        },
      })
    })()
  }, [submission])

  //
  useEffect(() => {
    if (activities.length === 0) return setSurvey(undefined)

    // Splice together all selected activities & their tags.
    Promise.all(activities.map((x) => LAMP.Type.getAttachment(x.id, "lamp.dashboard.survey_description"))).then(
      (res: any) => {
        let spliced = res.map((y, idx) =>
          spliceActivity({
            raw: activities[idx],
            tag: !!y.error ? undefined : y.data,
          })
        )

        // Short-circuit the main title & description if there's only one survey.
        const main = {
          name: spliced.length === 1 ? spliced[0].name : "Multi-questionnaire",
          description: spliced.length === 1 ? spliced[0].description : "Please complete all sections below. Thank you.",
        }
        if (spliced.length === 1) spliced[0].name = spliced[0].description = undefined

        setSurvey({
          name: main.name,
          description: main.description,
          sections: spliced,
          prefillData: !_patientMode() ? activities[0].prefillData : undefined,
          prefillTimestamp: !_patientMode() ? activities[0].prefillTimestamp : undefined,
        })
      }
    )
  }, [activities])

  //
  const hideEvent = async (timestamp, activity) => {
    let _hidden = (await LAMP.Type.getAttachment(participant.id, "lamp.dashboard.hidden_events")) as any
    let _events = !!_hidden.error ? [] : _hidden.data
    if (hiddenEvents.includes(`${timestamp}/${activity}`)) return
    let _setEvents = (await LAMP.Type.setAttachment(participant.id, "me", "lamp.dashboard.hidden_events", [
      ..._events,
      `${timestamp}/${activity}`,
    ])) as any
    if (!!_setEvents.error) return
    //setHiddenEvents([..._events, `${timestamp}/${activity}`])
    setSubmission((x) => x + 1)
  }

  //
  const submitSurvey = (response, overwritingTimestamp) => {
    setSurvey(undefined)

    //
    let events = response.map((x, idx) => ({
      timestamp: !!overwritingTimestamp ? overwritingTimestamp + 1000 /* 1sec */ : new Date().getTime(),
      duration: 0,
      activity: activities[idx].id,
      static_data: { survey_name: activities[idx].name },
      temporal_slices: (x || []).map((y) => ({
        item: y !== undefined ? y.item : null,
        value: y !== undefined ? y.value : null,
        type: null,
        level: null,
        duration: 0,
      })),
    }))

    //
    Promise.all(
      events
        .filter((x) => x.temporal_slices.length > 0)
        .map((x) => LAMP.ActivityEvent.create(participant.id, x).catch((e) => console.dir(e)))
    ).then((x) => {
      setSubmission((x) => x + 1)
    })

    // If a timestamp was provided to overwrite data, hide the original event too.
    if (!!overwritingTimestamp) hideEvent(overwritingTimestamp, activities[0 /* assumption made here */].id)
  }

  const earliestDate = () =>
    (state.activities || [])
      .filter((x) => (state.selectedCharts || []).includes(x.name))
      .map((x) => (state.activity_events || {})[x.name] || [])
      .map((x) => (x.length === 0 ? 0 : x.slice(0, 1)[0].timestamp))
      .sort((a, b) => a - b /* min */)
      .slice(0, 1)
      .map((x) => (x === 0 ? undefined : new Date(x)))[0]

  const pieData = () => [
    [
      {
        label: "Alone",
        value: ((state.sensor_events || {})["lamp.gps.contextual"] || []).filter(
          (x) => x.data.context.social === "alone"
        ).length,
      },
      {
        label: "Friends",
        value: ((state.sensor_events || {})["lamp.gps.contextual"] || []).filter(
          (x) => x.data.context.social === "friends"
        ).length,
      },
      {
        label: "Family",
        value: ((state.sensor_events || {})["lamp.gps.contextual"] || []).filter(
          (x) => x.data.context.social === "family"
        ).length,
      },
      {
        label: "Peers",
        value: ((state.sensor_events || {})["lamp.gps.contextual"] || []).filter(
          (x) => x.data.context.social === "peers"
        ).length,
      },
      {
        label: "Crowd",
        value: ((state.sensor_events || {})["lamp.gps.contextual"] || []).filter(
          (x) => x.data.context.social === "crowd"
        ).length,
      },
    ],
    [
      {
        label: "Home",
        value: ((state.sensor_events || {})["lamp.gps.contextual"] || []).filter(
          (x) => x.data.context.environment === "home" || x.data.context.environment === null
        ).length,
      },
      {
        label: "School",
        value: ((state.sensor_events || {})["lamp.gps.contextual"] || []).filter(
          (x) => x.data.context.environment === "school"
        ).length,
      },
      {
        label: "Work",
        value: ((state.sensor_events || {})["lamp.gps.contextual"] || []).filter(
          (x) => x.data.context.environment === "work"
        ).length,
      },
      {
        label: "Hospital",
        value: ((state.sensor_events || {})["lamp.gps.contextual"] || []).filter(
          (x) => x.data.context.environment === "hospital"
        ).length,
      },
      {
        label: "Outside",
        value: ((state.sensor_events || {})["lamp.gps.contextual"] || []).filter(
          (x) => x.data.context.environment === "outside"
        ).length,
      },
      {
        label: "Shopping",
        value: ((state.sensor_events || {})["lamp.gps.contextual"] || []).filter(
          (x) => x.data.context.environment === "shopping"
        ).length,
      },
      {
        label: "Transit",
        value: ((state.sensor_events || {})["lamp.gps.contextual"] || []).filter(
          (x) => x.data.context.environment === "transit"
        ).length,
      },
    ],
  ]

  return (
    <React.Fragment>
      {!_hideCareTeam() && tab === "prevent" && (
        <Box border={1} borderColor="grey.300" borderRadius={4} bgcolor="#fff" p={2} my={4}>
          <CareTeam participant={participant} />
        </Box>
      )}
      {tab === "learn" && (
        <Box>
          <Launcher.Section>
            <Grid container direction="row" spacing={4}>
              <Grid item xs={3}>
                {!_hideCareTeam() && (
                  <Launcher.Button
                    title="Mood Tips"
                    icon={<Mood style={{ width: "90%", height: "90%" }} />}
                    onClick={() => setLaunchedActivity("moodtips")}
                  />
                )}
              </Grid>
              <Grid item xs={3}>
                {!_hideCareTeam() && (
                  <Launcher.Button
                    title="Sleep Tips"
                    icon={<Sleep style={{ width: "90%", height: "90%" }} />}
                    onClick={() => setLaunchedActivity("sleeptips")}
                  />
                )}
              </Grid>
              <Grid item xs={3}>
                {!_hideCareTeam() && (
                  <Launcher.Button
                    title="Social Tips"
                    icon={<Social style={{ width: "90%", height: "90%" }} />}
                    onClick={() => setLaunchedActivity("socialtips")}
                  />
                )}
              </Grid>
              <Grid item xs={3}>
                {!_hideCareTeam() && (
                  <Launcher.Button
                    title="Mental Health Resources"
                    icon={<MentalHealth style={{ width: "90%", height: "90%" }} />}
                    onClick={() => setLaunchedActivity("resources")}
                  />
                )}
              </Grid>
              <Grid item xs={3}>
                {!_hideCareTeam() && (
                  <Launcher.Button
                    title="Book Recommendations"
                    icon={<Books style={{ width: "90%", height: "90%" }} />}
                    onClick={() => setLaunchedActivity("bookrecommendations")}
                  />
                )}
              </Grid>
              <Grid item xs={3}>
                {!_hideCareTeam() && (
                  <Launcher.Button
                    title="Definitions"
                    icon={<Information style={{ width: "90%", height: "90%" }} />}
                    onClick={() => setLaunchedActivity("definitions")}
                  />
                )}
              </Grid>
            </Grid>
          </Launcher.Section>
        </Box>
      )}
      {tab === "assess" && (
        <Box border={0} borderColor="grey.300" borderRadius={8} bgcolor="#fff" my={4}>
          <Launcher.Section>
            <Grid container direction="row" spacing={4}>
              {[
                ...(state.activities || [])
                  .filter((x) => x.spec === "lamp.group" && (_shouldRestrict() ? x.name.includes("SELF REPORT") : true))
                  .map((y) => (
                    <Grid item xs={3}>
                      <Launcher.Button
                        key={y.name}
                        notification
                        title={y.name}
                        icon={<Icon fontSize="large">menu_open</Icon>}
                        onClick={() =>
                          setActivities(
                            (state.activities ?? []).filter(
                              (x) => x.spec === "lamp.survey" && y.settings.includes(x.id)
                            )
                          )
                        }
                      />
                    </Grid>
                  )),
                ...(state.activities || [])
                  .filter(
                    (x) => x.spec === "lamp.survey" && (_shouldRestrict() ? x.name.includes("SELF REPORT") : true)
                  )
                  .map((y) => (
                    <Grid item xs={3}>
                      <Launcher.Button
                        key={y.name}
                        //favorite
                        title={y.name}
                        icon={<Surveys style={{ width: "90%", height: "90%" }} />}
                        onClick={() => setActivities([y])}
                      />
                    </Grid>
                  )),
              ]}
            </Grid>
          </Launcher.Section>
          <ResponsiveDialog transient animate fullScreen open={!!survey} onClose={() => setSurvey(undefined)}>
            <Box py={8} px={2}>
              <Grid container direction="row">
                <Grid item style={{ width: "100%" }}>
                  <Survey
                    validate
                    partialValidationOnly
                    content={survey}
                    prefillData={!!survey ? survey.prefillData : undefined}
                    prefillTimestamp={!!survey ? survey.prefillTimestamp : undefined}
                    onValidationFailure={() =>
                      enqueueSnackbar("Some responses are missing. Please complete all questions before submitting.", {
                        variant: "error",
                      })
                    }
                    onResponse={submitSurvey}
                  />
                </Grid>
                {supportsSidebar && !_patientMode() && (
                  <Grid item>
                    <Drawer
                      anchor="right"
                      variant="temporary"
                      open={!!sidebarOpen}
                      onClose={() => setSidebarOpen(undefined)}
                    >
                      <Box flexGrow={1} />
                      <Divider />
                      <Messages refresh={!!survey} expandHeight privateOnly participant={participant.id} />
                    </Drawer>
                    <Tooltip title="Patient Notes" placement="left">
                      <Fab
                        color="primary"
                        aria-label="Patient Notes"
                        style={{ position: "fixed", bottom: 85, right: 24 }}
                        onClick={() => setSidebarOpen(true)}
                      >
                        <Icon>note_add</Icon>
                      </Fab>
                    </Tooltip>
                  </Grid>
                )}
              </Grid>
            </Box>
          </ResponsiveDialog>
        </Box>
      )}
      {tab === "manage" && (
        <Box border={0} borderColor="grey.300" borderRadius={8} bgcolor="#fff" my={4}>
          <Launcher.Section>
            <Grid container direction="row" spacing={4}>
              <Grid item xs={3}>
                {!_hideCareTeam() && (
                  <Launcher.Button
                    title="Breathe"
                    icon={<BreatheIcon style={{ width: "90%", height: "90%" }} />}
                    onClick={() => setLaunchedActivity("breathe")}
                  />
                )}
              </Grid>
              <Grid item xs={3}>
                {!_hideCareTeam() && (
                  <Launcher.Button
                    title="Jewels"
                    icon={<JewelsIcon style={{ width: "90%", height: "90%" }} />}
                    onClick={() => setLaunchedActivity("jewels")}
                  />
                )}
              </Grid>
              <Grid item xs={3}>
                {!_hideCareTeam() && (
                  <Launcher.Button
                    title="Journal"
                    icon={<JournalIcon style={{ width: "90%", height: "90%" }} />}
                    onClick={() => setLaunchedActivity("journal")}
                  />
                )}
              </Grid>
              <Grid item xs={3}>
                {!_hideCareTeam() && (
                  <Launcher.Button
                    title="Hope Box"
                    icon={<Hope style={{ width: "90%", height: "90%" }} />}
                    onClick={() => setLaunchedActivity("hopebox")}
                  />
                )}
              </Grid>
            </Grid>
          </Launcher.Section>
        </Box>
      )}
      <ResponsiveDialog
        transient
        animate
        fullScreen
        open={!!launchedActivity}
        onClose={() => setLaunchedActivity(undefined)}
      >
        {
          {
            breathe: <Breathe onComplete={() => setLaunchedActivity(undefined)} />,
            jewels: <Jewels onComplete={() => setLaunchedActivity(undefined)} />,
            journal: <Journal onComplete={() => setLaunchedActivity(undefined)} />,
            hopebox: <Hopebox onComplete={() => setLaunchedActivity(undefined)} />,
            resources: <Resources onComplete={() => setLaunchedActivity(undefined)} />,
            sleeptips: <SleepTips onComplete={() => setLaunchedActivity(undefined)} />,
            moodtips: <MoodTips onComplete={() => setLaunchedActivity(undefined)} />,
            socialtips: <SocialTips onComplete={() => setLaunchedActivity(undefined)} />,
            bookrecommendations: <BookRecommendations onComplete={() => setLaunchedActivity(undefined)} />,
            definitions: <Definitions onComplete={() => setLaunchedActivity(undefined)} />,
          }[launchedActivity ?? ""]
        }
      </ResponsiveDialog>
      {tab === "prevent" && (
        <React.Fragment>
          <Box border={1} borderColor="grey.300" borderRadius={8} bgcolor="#fff" p={2} mx="10%">
            <Box display="flex" justifyContent="space-between">
              <Typography variant="overline">Activity</Typography>
              <Box>
                <Typography variant="overline" color="inherit">
                  Show All
                </Typography>
                <Switch
                  size="small"
                  checked={state.showAll}
                  onChange={() =>
                    setState({
                      ...state,
                      showAll: !state.showAll,
                      selectedCharts: undefined,
                    })
                  }
                />
              </Box>
            </Box>
            <MultipleSelect
              selected={state.selectedCharts || []}
              items={(state.activities || [])
                .filter((x) => x.spec === "lamp.survey" || !!state.showAll)
                .map((x) => `${x.name}`)}
              showZeroBadges={false}
              badges={state.activity_counts}
              onChange={(x) => setState({ ...state, selectedCharts: x })}
            />
            {!_hideCareTeam() && (
              <React.Fragment>
                <Divider style={{ margin: "8px -16px 8px -16px" }} />
                <Typography variant="overline">Sensor</Typography>
                <MultipleSelect
                  selected={state.selectedPassive || []}
                  items={[`Environmental Context`, `Step Count`]}
                  showZeroBadges={false}
                  badges={state.sensor_counts}
                  onChange={(x) => setState({ ...state, selectedPassive: x })}
                />
              </React.Fragment>
            )}
            {Object.keys(visualizations).length > 0 && (
              <React.Fragment>
                <Divider style={{ margin: "8px -16px 8px -16px" }} />
                <Typography variant="overline">Automations</Typography>
                <MultipleSelect
                  tooltips={{}}
                  defaultTooltip="An experimental visualization generated by an automation you or your clinician have installed."
                  selected={state.selectedExperimental || []}
                  items={Object.keys(visualizations).map((x) => x.replace("lamp.dashboard.experimental.", ""))}
                  showZeroBadges={false}
                  badges={Object.keys(visualizations)
                    .map((x) => x.replace("lamp.dashboard.experimental.", ""))
                    .reduce((prev, curr) => ({ ...prev, [curr]: 1 }), {})}
                  onChange={(x) => setState({ ...state, selectedExperimental: x })}
                />
              </React.Fragment>
            )}
          </Box>
          {(state.selectedCharts || []).length + (state.selectedPassive || []).length === 0 && (
            <Box
              display="flex"
              justifyContent="center"
              border={1}
              borderColor={blue[700]}
              borderRadius={8}
              bgcolor="grey.100"
              color={blue[700]}
              p={2}
              my={4}
              mx="10%"
            >
              <Typography variant="overline" align="center">
                <b>No Activities are selected. Please select an Activity above to begin.</b>
              </Typography>
            </Box>
          )}
          {(state.activities || [])
            .filter((x) => (state.selectedCharts || []).includes(x.name))
            .map((activity) => (
              <Card key={activity.id} style={{ marginTop: 16, marginBottom: 16 }}>
                <ActivityCard
                  activity={activity}
                  events={(state.activity_events || {})[activity.name] || []}
                  startDate={earliestDate()}
                  forceDefaultGrid={_hideCareTeam()}
                  onEditAction={
                    activity.spec !== "lamp.survey" || _patientMode()
                      ? undefined
                      : (data) => {
                          setActivities([
                            {
                              ...activity,
                              prefillData: [
                                data.slice.map(({ item, value }) => ({
                                  item,
                                  value,
                                })),
                              ],
                              prefillTimestamp: data.x.getTime() /* post-increment later to avoid double-reporting events! */,
                            },
                          ])
                        }
                  }
                  onCopyAction={
                    activity.spec !== "lamp.survey" || _patientMode()
                      ? undefined
                      : (data) => {
                          setActivities([
                            {
                              ...activity,
                              prefillData: [
                                data.slice.map(({ item, value }) => ({
                                  item,
                                  value,
                                })),
                              ],
                            },
                          ])
                        }
                  }
                  onDeleteAction={_patientMode() ? undefined : (x) => hideEvent(x.x.getTime(), activity.id)}
                />
              </Card>
            ))}
          {!(state.selectedPassive || []).includes("Environmental Context") ? (
            <React.Fragment />
          ) : (
            <Card style={{ marginTop: 16, marginBottom: 16 }}>
              <Typography component="h6" variant="h6" align="center" style={{ width: "100%", margin: 16 }}>
                Environmental Context
              </Typography>
              <Divider />
              <MultiPieChart data={pieData()} />
            </Card>
          )}
          {!(state.selectedPassive || []).includes("Step Count") ? (
            <React.Fragment />
          ) : (
            <Card style={{ marginTop: 16, marginBottom: 16 }}>
              <Typography component="h6" variant="h6" align="center" style={{ width: "100%", margin: 16 }}>
                Step Count
              </Typography>
              <Divider />
              <Sparkline
                minWidth={250}
                minHeight={250}
                XAxisLabel="Time"
                YAxisLabel="Steps Taken"
                color={blue[500]}
                startDate={earliestDate()}
                data={((state.sensor_events || {})["lamp.steps"] || []).map((d) => ({
                  x: new Date(parseInt(d.timestamp)),
                  y: d.data.value || 0,
                }))}
              />
            </Card>
          )}
          {(state.selectedExperimental || []).map((x) => (
            <Card key={x} style={{ marginTop: 16, marginBottom: 16 }}>
              <Typography component="h6" variant="h6" align="center" style={{ width: "100%", margin: 16 }}>
                {x}
              </Typography>
              <Divider style={{ marginBottom: 16 }} />
              <Grid container justify="center">
                <img
                  alt="visualization"
                  src={visualizations["lamp.dashboard.experimental." + x]}
                  height="85%"
                  width="85%"
                />
              </Grid>
            </Card>
          ))}
        </React.Fragment>
      )}
      <Drawer
        open
        anchor={supportsSidebar ? "left" : "bottom"}
        variant="permanent"
        PaperProps={{
          style: {
            flexDirection: supportsSidebar ? "column" : "row",
            justifyContent: !supportsSidebar ? "center" : undefined,
            height: !supportsSidebar ? 56 : undefined,
          },
        }}
      >
        <BottomNavigationAction
          showLabel
          selected={tab === "learn"}
          label="Learn"
          value="learn"
          icon={<Icon>bookmark_border</Icon>}
          onChange={(_, newTab) => setTab(newTab)}
        />
        <BottomNavigationAction
          showLabel
          selected={tab === "assess"}
          label="Assess"
          value="assess"
          icon={<Icon>assessment</Icon>}
          onChange={(_, newTab) => setTab(newTab)}
        />
        <BottomNavigationAction
          showLabel
          selected={tab === "manage"}
          label="Manage"
          value="manage"
          icon={<Icon>create_outlined</Icon>}
          onChange={(_, newTab) => setTab(newTab)}
        />
        <BottomNavigationAction
          showLabel
          selected={tab === "prevent"}
          label="Prevent"
          value="prevent"
          icon={<Icon>speaker_notes_outlined</Icon>}
          onChange={(_, newTab) => setTab(newTab)}
        />
      </Drawer>
    </React.Fragment>
  )
}