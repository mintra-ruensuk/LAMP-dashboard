
// Core Imports
import React, { useState, useEffect, useCallback } from 'react'
import IconButton from '@material-ui/core/IconButton'
import Box from '@material-ui/core/Box'
import Icon from '@material-ui/core/Icon'
import Switch from '@material-ui/core/Switch'
import Button from '@material-ui/core/Button'
import Typography from '@material-ui/core/Typography'
import TextField from '@material-ui/core/TextField'
import Popover from '@material-ui/core/Popover'
import MenuItem from '@material-ui/core/MenuItem'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogActions from '@material-ui/core/DialogActions'
import Tabs from '@material-ui/core/Tabs'
import Tab from '@material-ui/core/Tab'
import Divider from '@material-ui/core/Divider'
import Chip from '@material-ui/core/Chip'
import Slide from '@material-ui/core/Slide'
import Tooltip from '@material-ui/core/Tooltip'
import MaterialTable from 'material-table'
import red from '@material-ui/core/colors/red'

// External Imports 
import { saveAs } from 'file-saver'
import { useDropzone } from 'react-dropzone'

// Local Imports
import LAMP from '../lamp'
import Activity from './Activity'
import SurveyCreator from './SurveyCreator'

function SlideUp(props) { return <Slide direction="up" {...props} /> }


// TODO: Blogs/Tips/AppHelp


export default function ActivityList({ title, activities, studyID, onChange, ...props }) {
    const [showCreate, setShowCreate] = useState()
    const [showActivityImport, setShowActivityImport] = useState()
    const [importFile, setImportFile] = useState()
    const [exportActivities, setExportActivities] = useState()
    const [selectedActivity, setSelectedActivity] = useState()
    useEffect(() => { onChange() }, [showCreate])

    const onDrop = useCallback(acceptedFiles => {
        const reader = new FileReader()
        reader.onabort = () => props.layout.showAlert('Couldn\'t import the Activities.')
        reader.onerror = () => props.layout.showAlert('Couldn\'t import the Activities.')
        reader.onload = () => {
            setShowActivityImport()
            let obj = JSON.parse(reader.result)
            if (Array.isArray(obj) && obj.filter(x => (typeof x === 'object' && !!x.name && !!x.settings && !!x.schedule)).length > 0)
                setImportFile(obj)
            else props.layout.showAlert('Couldn\'t import the Activities.')
        }
        acceptedFiles.forEach(file => reader.readAsText(file))
    }, [])
    const { acceptedFiles, getRootProps, getInputProps, isDragActive, isDragAccept } = useDropzone({
        onDrop, accept: 'application/json,.json', maxSize: 1 * 1024 * 1024 /* 5MB */
    })

    const importActivities = async () => {
        let allIDs = importFile.map(x => x.id).reduce((prev, curr) => ({ ...prev, [curr]: undefined }), {})
        let brokenGroupsCount = importFile
            .filter(activity => activity.spec === 'lamp.group')
            .filter(activity => activity.settings
                .filter(x => !Object.keys(allIDs).includes(x)).length > 0)
            .length
        if (brokenGroupsCount > 0) {
            setImportFile()
            props.layout.showAlert('Couldn\'t import the Activities because some Activities are misconfigured or missing.')
            return
        }

        for (let x of importFile.filter(x => x.spec !== 'lamp.group'))
            allIDs[x.id] = (await LAMP.Activity.create(studyID, { ...x, id: undefined, tableData: undefined })).data
        for (let x of importFile.filter(x => x.spec === 'lamp.group'))
            await LAMP.Activity.create(studyID, { ...x, id: undefined, tableData: undefined, settings: x.settings.map(y => allIDs[y]) })

        onChange()
        setImportFile()
    }

	return (
        <React.Fragment>
            <MaterialTable 
                title={title}
                data={activities} 
                columns={[
                    { title: 'Name', field: 'name' }, 
                    { title: 'Type', field: 'spec', lookup: { 'lamp.survey': 'Survey', 'lamp.group': 'Group' }, emptyValue: 'Cognitive Test' },
                ]}
                onRowClick={(event, rowData, togglePanel) => setSelectedActivity(rowData)}
                actions={[
                    {
                        icon: 'cloud_upload',
                        tooltip: 'Import',
                        isFreeAction: true,
                        onClick: (event, rows) => setShowActivityImport(true)
                    }, {
                        icon: 'cloud_download',
                        tooltip: 'Export',
                        onClick: (event, rows) => {
                            saveAs(new Blob(
                                [JSON.stringify(rows.map(x => ({ ...x, tableData: undefined })), undefined, 4)], 
                                { type: 'text/plain;charset=utf-8' }), 
                            'export.json')
                        }
                    }, {
                        icon: 'add_box',
                        tooltip: 'Create',
                        isFreeAction: true,
                        onClick: (event, rows) => setShowCreate(true)
                    }, {
                        icon: 'delete_forever',
                        tooltip: 'Delete',
                        onClick: async (event, rows) => {
                            for (let activity of rows)
                                console.dir(await LAMP.Activity.delete(activity.id))
                            onChange()
                        }                  
                    },
                ]}
                localization={{
                    body: {
                        emptyDataSourceMessage: 'No Activities. Add Activities by clicking the [+] button above.',
                        editRow: {
                            deleteText: 'Are you sure you want to delete this Activity?'
                        }
                    }
                }}
                options={{
                    selection: true,
                    actionsColumnIndex: -1,
                    pageSize: 10,
                    pageSizeOptions: [10, 25, 50, 100]
                }}
                components={{ Container: props => <div {...props} /> }}
            />
            <Dialog
                open={!!showActivityImport}
                onClose={() => setShowActivityImport()}
            >
                <Box {...getRootProps()} 
                    p={4} 
                    bgcolor={(isDragActive || isDragAccept) ? 'primary.main' : undefined} 
                    color={!(isDragActive || isDragAccept) ? 'primary.main' : '#fff'}
                >
                    <input {...getInputProps()} />
                    <Typography variant="h6">
                        Drag files here, or click to select files.
                    </Typography>
                </Box>
            </Dialog>
            <Dialog
                open={!!importFile}
                onClose={() => setImportFile()}
            >
                <MaterialTable 
                    title="Continue importing?"
                    data={importFile || []} 
                    columns={[{ title: 'Activity Name', field: 'name' }]}
                    options={{ search: false, selection: false }}
                    components={{ Container: props => <div {...props} /> }}
                />
                <DialogActions>
                    <Button onClick={() => setImportFile()} color="secondary" autoFocus>
                        Cancel
                    </Button>
                    <Button onClick={importActivities} color="primary" autoFocus>
                        Import
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog
                fullScreen
                open={!!showCreate}
                onClose={() => setShowCreate()}
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
                    onClick={() => setShowCreate()} 
                    aria-label="Close"
                >
                    <Icon>close</Icon>
                </IconButton>
                <Box py={8} px={4}>
                    <SurveyCreator onCancel={() => setShowCreate()} onSave={x => LAMP.Activity.create(studyID, x).then(() => setShowCreate())} />
                </Box>
            </Dialog>
            <Dialog
                fullScreen
                open={!!selectedActivity}
                onClose={() => setSelectedActivity()}
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
                    onClick={() => setSelectedActivity()} 
                    aria-label="Close"
                >
                    <Icon>close</Icon>
                </IconButton>
                <Box py={8} px={4}>
                    <Activity activity={selectedActivity} studyID={studyID} />
                </Box>
            </Dialog>
        </React.Fragment>
    )
}