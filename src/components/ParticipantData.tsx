import * as React from "react"
import { Box, Card, Switch, Typography, Divider, Grid, colors, useMediaQuery } from "@material-ui/core"
import LAMP, {
  Participant as ParticipantObj,
  Activity as ActivityObj,
  ActivityEvent as ActivityEventObj,
  SensorEvent as SensorEventObj,
  Activity,
} from "lamp-core"
import { useSnackbar } from "notistack"
import ActivityCard from "./ActivityCard"
import MultipleSelect from "./MultipleSelect"
import Sparkline from "./Sparkline"
import MultiPieChart from "./MultiPieChart"

// TODO: all SensorEvents?

function _hideExperimental() {
  return (LAMP.Auth._auth.serverAddress || "").includes(".psych.digital")
}

const strategies = {
  "lamp.survey": (slices, activity, scopedItem) =>
    (slices ?? [])
      .filter((x, idx) => (scopedItem !== undefined ? idx === scopedItem : true))
      .map((x, idx) => {
        let question = (Array.isArray(activity.settings) ? activity.settings : []).filter((y) => y.text === x.item)[0]
        if (!!question && question.type === "boolean") return ["Yes", "True"].includes(x.value) ? 1 : 0
        else if (!!question && question.type === "list") return Math.max(question.options.indexOf(x.value), 0)
        else return parseInt(x.value) || 0
      })
      .reduce((prev, curr) => prev + curr, 0),
  "lamp.dashboard.custom_survey_group": (slices, activity, scopedItem) =>
    (slices ?? [])
      .filter((x, idx) => (scopedItem !== undefined ? idx === scopedItem : true))
      .map((x, idx) => {
        let question = (Array.isArray(activity.settings) ? activity.settings : []).filter((y) => y.text === x.item)[0]
        if (!!question && question.type === "boolean") return ["Yes", "True"].includes(x.value) ? 1 : 0
        else if (!!question && question.type === "list") return Math.max(question.options.indexOf(x.value), 0)
        else return parseInt(x.value) || 0
      })
      .reduce((prev, curr) => prev + curr, 0),
  "lamp.jewels_a": (slices, activity, scopedItem) =>
    slices.map((x) => parseInt(x.item) || 0).reduce((prev, curr) => (prev > curr ? prev : curr), 0),
  __default__: (slices, activity, scopedItem) =>
    slices.map((x) => parseInt(x.item) || 0).reduce((prev, curr) => (prev > curr ? prev : curr), 0),
}

export function getStrategy(activity: Activity) {
  // FIXME: we need this patch because we don't have strategies for anything other than surveys + custom groups.
  return strategies[
    ["lamp.dashboard.custom_survey_group", "lamp.survey", "lamp.jewels_a"].includes(activity.spec)
      ? activity.spec
      : "__default__"
  ]
}

async function getActivities(participant: ParticipantObj) {
  let original = await LAMP.Activity.allByParticipant(participant.id)
  let custom =
    ((await LAMP.Type.getAttachment(participant.id, "lamp.dashboard.custom_survey_groups")) as any)?.data?.map((x) => ({
      ...x,
      spec: "lamp.dashboard.custom_survey_group",
      schedule: {},
      settings: x.settings.map((y) => ({
        ...y,
        ...original.find((z) => z.name === y.activity)?.settings.find((a) => a.text === y.question),
      })),
    })) ?? [] // original.filter((x) => x.spec !== "lamp.survey")
  return [...original, ...custom]
}

async function getVisualizations(participant: ParticipantObj) {
  let visualizations = {}
  for (let attachmentID of ((await LAMP.Type.listAttachments(participant.id)) as any).data) {
    if (!attachmentID.startsWith("lamp.dashboard.experimental")) continue
    let bstr = ((await LAMP.Type.getAttachment(participant.id, attachmentID)) as any).data
    visualizations[attachmentID] = bstr.startsWith("data:") ? bstr : `data:image/svg+xml;base64,${bstr}` // defaults
  }
  return visualizations
}

// Perform event coalescing/grouping by sensor or activity type.
async function getActivityEvents(
  participant: ParticipantObj,
  _activities: ActivityObj[],
  _hidden: string[]
): Promise<{ [groupName: string]: ActivityEventObj[] }> {
  let original = (await LAMP.ActivityEvent.allByParticipant(participant.id))
    .map((x) => ({
      ...x,
      activity: _activities.find((y) => x.activity === y.id),
    }))
    .filter((x) => (!!x.activity ? !_hidden.includes(`${x.timestamp}/${x.activity.id}`) : true))
    .sort((x, y) => x.timestamp - y.timestamp)
    .map((x) => ({
      ...x,
      activity: (x.activity || { name: "" }).name,
    }))
    .groupBy("activity") as any
  let customEvents = _activities
    .filter((x) => x.spec === "lamp.dashboard.custom_survey_group")
    .map((x) =>
      x?.settings?.map((y, idx) =>
        original?.[y.activity]
          ?.map((z) => ({
            idx: idx,
            timestamp: z.timestamp,
            duration: z.duration,
            activity: x.name,
            slices: z.temporal_slices.find((a) => a.item === y.question),
          }))
          .filter((y) => y.slices !== undefined)
      )
    )
    .filter((x) => x !== undefined)
    .flat(2)
    .groupBy("activity")
  let customGroups = Object.entries(customEvents).map(([k, x]) => [
    k,
    Object.values(x.groupBy("timestamp")).map((z: any) => ({
      timestamp: z?.[0].timestamp,
      duration: z?.[0].duration,
      activity: z?.[0].activity,
      static_data: {},
      temporal_slices: Array.from(
        z?.reduce((prev, curr) => ({ ...prev, [curr.idx]: curr.slices }), {
          length:
            z
              .map((a) => a.idx)
              .sort()
              .slice(-1)[0] + 1,
        })
      ).map((a) => (a === undefined ? {} : a)),
    })),
  ])
  return Object.fromEntries([...Object.entries(original), ...customGroups])
}

// Perform event coalescing/grouping by sensor or activity type.
async function getSensorEvents(participant: ParticipantObj): Promise<{ [groupName: string]: SensorEventObj[] }> {
  let _events = ((await LAMP.SensorEvent.allByParticipant(participant.id)) as any).groupBy("sensor")

  // Perform datetime coalescing to either days or weeks.
  _events["lamp.steps"] = Object.values(
    ((_events || {})["lamp.steps"] || [])
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
  return _events
}

// Perform count coalescing on processed events grouped by type.
function getActivityEventCount(activity_events: { [groupName: string]: ActivityEventObj[] }) {
  return Object.assign(
    {},
    ...Object.entries(activity_events || {}).map(([k, v]: [string, any[]]) => ({
      [k]: v.length,
    }))
  )
}

// Perform count coalescing on processed events grouped by type.
function getSensorEventCount(sensor_events: { [groupName: string]: SensorEventObj[] }) {
  return {
    "Environmental Context":
      sensor_events?.["lamp.gps.contextual"]?.filter((x) => !!x.data?.context?.environment || !!x.data?.context?.social)
        ?.length ?? 0,
    "Step Count": sensor_events?.["lamp.steps"]?.length ?? 0,
  }
}

function getEnvironmentalContextGroups(gps_events?: SensorEventObj[]) {
  gps_events = gps_events?.filter((x) => !!x.data?.context?.environment || !!x.data?.context?.social) ?? [] // Catch missing data.
  return [
    [
      {
        label: "Alone",
        value: gps_events.filter((x) => x.data.context.social === "alone").length,
      },
      {
        label: "Friends",
        value: gps_events.filter((x) => x.data.context.social === "friends").length,
      },
      {
        label: "Family",
        value: gps_events.filter((x) => x.data.context.social === "family").length,
      },
      {
        label: "Peers",
        value: gps_events.filter((x) => x.data.context.social === "peers").length,
      },
      {
        label: "Crowd",
        value: gps_events.filter((x) => x.data.context.social === "crowd").length,
      },
    ],
    [
      {
        label: "Home",
        value: gps_events.filter((x) => x.data.context.environment === "home" || x.data.context.environment === null)
          .length,
      },
      {
        label: "School",
        value: gps_events.filter((x) => x.data.context.environment === "school").length,
      },
      {
        label: "Work",
        value: gps_events.filter((x) => x.data.context.environment === "work").length,
      },
      {
        label: "Hospital",
        value: gps_events.filter((x) => x.data.context.environment === "hospital").length,
      },
      {
        label: "Outside",
        value: gps_events.filter((x) => x.data.context.environment === "outside").length,
      },
      {
        label: "Shopping",
        value: gps_events.filter((x) => x.data.context.environment === "shopping").length,
      },
      {
        label: "Transit",
        value: gps_events.filter((x) => x.data.context.environment === "transit").length,
      },
    ],
  ]
}

export default function ParticipantData({
  participant,
  hiddenEvents,
  enableEditMode,
  onEditAction,
  onCopyAction,
  onDeleteAction,
  ...props
}: {
  participant: ParticipantObj
  hiddenEvents: string[]
  enableEditMode: boolean
  onEditAction: (activity: ActivityObj, data: any) => void
  onCopyAction: (activity: ActivityObj, data: any) => void
  onDeleteAction: (activity: ActivityObj, data: any) => void
}) {
  const [showAll, setShowAll] = React.useState(false)
  const [activities, setActivities] = React.useState([])
  const [activityEvents, setActivityEvents] = React.useState({})
  const [sensorEvents, setSensorEvents] = React.useState({})
  const [activityCounts, setActivityCounts] = React.useState({})
  const [sensorCounts, setSensorCounts] = React.useState({})
  const [selectedActivities, setSelectedActivities] = React.useState([])
  const [selectedSensors, setSelectedSensors] = React.useState([])
  const [selectedExperimental, setSelectedExperimental] = React.useState([])
  const [visualizations, setVisualizations] = React.useState({})
  const printView = useMediaQuery("print")

  React.useEffect(() => {
    getVisualizations(participant).then(setVisualizations)
    ;(async () => {
      let activities = await getActivities(participant)
      setActivities(activities)
      let activityEvents = await getActivityEvents(participant, activities, hiddenEvents)
      setActivityEvents(activityEvents)
      let activityEventCount = getActivityEventCount(activityEvents)
      setActivityCounts(activityEventCount)
      let sensorEvents = await getSensorEvents(participant)
      setSensorEvents(sensorEvents)
      let sensorEventCount = getSensorEventCount(sensorEvents)
      setSensorCounts(sensorEventCount)
    })()
  }, [])

  const earliestDate = () =>
    (activities || [])
      .filter((x) => (selectedActivities || []).includes(x.name))
      .map((x) => (activityEvents || {})[x.name] || [])
      .map((x) => (x.length === 0 ? 0 : x.slice(0, 1)[0].timestamp))
      .sort((a, b) => a - b /* min */)
      .slice(0, 1)
      .map((x) => (x === 0 ? undefined : new Date(x)))[0]

  return (
    <React.Fragment>
      <Box border={1} borderColor="grey.300" borderRadius={8} bgcolor="white" p={2} mx="10%" displayPrint="none">
        <Box display="flex" justifyContent="space-between">
          <Typography variant="overline">Activity</Typography>
          <Box>
            <Typography variant="overline" color="inherit">
              Show All
            </Typography>
            <Switch
              size="small"
              checked={showAll}
              onChange={() => {
                setShowAll((x) => !x)
              }}
            />
          </Box>
        </Box>
        <MultipleSelect
          selected={selectedActivities}
          items={(activities || [])
            .filter((x) => ["lamp.survey", "lamp.dashboard.custom_survey_group"].includes(x.spec) || !!showAll)
            .map((x) => `${x.name}`)}
          showZeroBadges={false}
          badges={activityCounts}
          onChange={(x) => setSelectedActivities(x)}
        />
        {!_hideExperimental() && (
          <React.Fragment>
            <Divider style={{ margin: "8px -16px 8px -16px" }} />
            <Typography variant="overline">Sensor</Typography>
            <MultipleSelect
              selected={selectedSensors || []}
              items={[`Environmental Context`, `Step Count`]}
              showZeroBadges={false}
              badges={sensorCounts}
              onChange={(x) => setSelectedSensors(x)}
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
              selected={selectedExperimental || []}
              items={Object.keys(visualizations).map((x) => x.replace("lamp.dashboard.experimental.", ""))}
              showZeroBadges={false}
              badges={Object.keys(visualizations)
                .map((x) => x.replace("lamp.dashboard.experimental.", ""))
                .reduce((prev, curr) => ({ ...prev, [curr]: 1 }), {})}
              onChange={(x) => setSelectedExperimental(x)}
            />
          </React.Fragment>
        )}
      </Box>
      <Box display="none" displayPrint="block">
        {activities.map((x) => (
          <Card style={{ padding: 8, margin: 16 }}>
            <Typography variant="h6">{x.name}</Typography>
            <Typography variant="subtitle2" color="primary">
              {((activityEvents || {})[x.name] || []).slice(-1).length > 0
                ? strategies["lamp.survey"](
                    ((activityEvents || {})[x.name] || []).slice(-1)?.[0]?.temporal_slices,
                    x,
                    undefined
                  )
                : "No Data"}
            </Typography>
          </Card>
        ))}
      </Box>
      {(selectedActivities || []).length + (selectedSensors || []).length + (selectedExperimental || []).length ===
        0 && (
        <Box
          display="flex"
          justifyContent="center"
          border={1}
          borderColor={colors.blue[700]}
          borderRadius={8}
          bgcolor="grey.100"
          color={colors.blue[700]}
          p={2}
          my={4}
          mx="10%"
          displayPrint="none"
        >
          <Typography variant="overline" align="center">
            <b>No Activities are selected. Please select an Activity above to begin.</b>
          </Typography>
        </Box>
      )}
      <Box displayPrint="visible">
        {(activities || [])
          .filter((x) => (selectedActivities || []).includes(x.name) || !!printView)
          .map((activity) => (
            <Card
              key={activity.id}
              style={{ marginTop: 16, marginBottom: 16, overflow: "visible", breakInside: "avoid" }}
            >
              <ActivityCard
                activity={activity}
                events={(activityEvents || {})[activity.name] || []}
                startDate={earliestDate()}
                forceDefaultGrid={_hideExperimental()}
                onEditAction={
                  activity.spec !== "lamp.survey" || !enableEditMode
                    ? undefined
                    : (data) => onEditAction(activity, data)
                }
                onCopyAction={
                  activity.spec !== "lamp.survey" || !enableEditMode
                    ? undefined
                    : (data) => onCopyAction(activity, data)
                }
                onDeleteAction={
                  activity.spec !== "lamp.survey" || !enableEditMode
                    ? undefined
                    : (data) => onDeleteAction(activity, data)
                }
              />
            </Card>
          ))}
        {((selectedSensors || []).includes("Environmental Context") || !!printView) && (
          <Card style={{ marginTop: 16, marginBottom: 16 }}>
            <Typography component="h6" variant="h6" align="center" style={{ width: "100%", margin: 16 }}>
              Environmental Context
            </Typography>
            <Divider />
            <MultiPieChart data={getEnvironmentalContextGroups(sensorEvents?.["lamp.gps.contextual"])} />
          </Card>
        )}
        {((selectedSensors || []).includes("Step Count") || !!printView) && (
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
              color={colors.blue[500]}
              startDate={earliestDate()}
              data={
                sensorEvents?.["lamp.steps"]?.map((d) => ({
                  x: new Date(parseInt(d.timestamp)),
                  y: d.data.value || 0,
                })) ?? []
              }
            />
          </Card>
        )}
        {(selectedExperimental || []).map((x) => (
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
      </Box>
    </React.Fragment>
  )
}
