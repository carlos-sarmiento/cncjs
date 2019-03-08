//import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import semver from 'semver';
import styled from 'styled-components';
import _without from 'lodash/without';
import Push from 'push.js';
import api from 'app/api';
import Anchor from 'app/components/Anchor';
import Badge from 'app/components/Badge';
import { Button } from 'app/components/Buttons';
import { Container, Row, Col } from 'app/components/GridSystem';
import Dropdown, { MenuItem } from 'app/components/Dropdown';
import FontAwesomeIcon from 'app/components/FontAwesomeIcon';
import Hoverable from 'app/components/Hoverable';
import Image from 'app/components/Image';
//import Margin from 'app/components/Margin';
import Space from 'app/components/Space';
import { Tooltip } from 'app/components/Tooltip';
import Text from 'app/components/Text';
import settings from 'app/config/settings';
import combokeys from 'app/lib/combokeys';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import log from 'app/lib/log';
import * as user from 'app/lib/user';
import config from 'app/store/config';
//import QuickAccessToolbar from './QuickAccessToolbar';
//import styles from './index.styl';
import logo from 'app/images/logo-badge-32x32.png';

const releases = 'https://github.com/cncjs/cncjs/releases';

const UserDropdownToggle = styled(Button)`
    & {
        background: none;
        border: none;
        opacity: 0.6;

        :hover {
            background: none;
            opacity: 1;
        }
    }
`;

class Header extends PureComponent {
    static propTypes = {
        ...withRouter.propTypes
    };

    state = this.getInitialState();
    actions = {
        requestPushPermission: () => {
            const onGranted = () => {
                this.setState({ pushPermission: Push.Permission.GRANTED });
            };
            const onDenied = () => {
                this.setState({ pushPermission: Push.Permission.DENIED });
            };
            // Note that if "Permission.DEFAULT" is returned, no callback is executed
            const permission = Push.Permission.request(onGranted, onDenied);
            if (permission === Push.Permission.DEFAULT) {
                this.setState({ pushPermission: Push.Permission.DEFAULT });
            }
        },
        checkForUpdates: async () => {
            try {
                const res = await api.getState();
                const { checkForUpdates } = res.body;

                if (checkForUpdates) {
                    const res = await api.getLatestVersion();
                    const { time, version } = res.body;

                    this._isMounted && this.setState({
                        latestVersion: version,
                        latestTime: time
                    });
                }
            } catch (res) {
                // Ignore error
            }
        },
        fetchCommands: async () => {
            try {
                const res = await api.commands.fetch({ paging: false });
                const { records: commands } = res.body;

                this._isMounted && this.setState({
                    commands: commands.filter(command => command.enabled)
                });
            } catch (res) {
                // Ignore error
            }
        },
        runCommand: async (cmd) => {
            try {
                const res = await api.commands.run(cmd.id);
                const { taskId } = res.body;

                this.setState({
                    commands: this.state.commands.map(c => {
                        return (c.id === cmd.id) ? { ...c, taskId: taskId, err: null } : c;
                    })
                });
            } catch (res) {
                // Ignore error
            }
        }
    };

    actionHandlers = {
        CONTROLLER_COMMAND: (event, { command }) => {
            // feedhold, cyclestart, homing, unlock, reset
            controller.command(command);
        }
    };

    controllerEvents = {
        'config:change': () => {
            this.actions.fetchCommands();
        },
        'task:start': (taskId) => {
            this.setState({
                runningTasks: this.state.runningTasks.concat(taskId)
            });
        },
        'task:finish': (taskId, code) => {
            const err = (code !== 0) ? new Error(`errno=${code}`) : null;
            let cmd = null;

            this.setState({
                commands: this.state.commands.map(c => {
                    if (c.taskId !== taskId) {
                        return c;
                    }
                    cmd = c;
                    return {
                        ...c,
                        taskId: null,
                        err: err
                    };
                }),
                runningTasks: _without(this.state.runningTasks, taskId)
            });

            if (cmd && this.state.pushPermission === Push.Permission.GRANTED) {
                Push.create(cmd.title, {
                    body: code === 0
                        ? i18n._('Command succeeded')
                        : i18n._('Command failed ({{err}})', { err: err }),
                    icon: 'images/logo-badge-32x32.png',
                    timeout: 10 * 1000,
                    onClick: function () {
                        window.focus();
                        this.close();
                    }
                });
            }
        },
        'task:error': (taskId, err) => {
            let cmd = null;

            this.setState({
                commands: this.state.commands.map(c => {
                    if (c.taskId !== taskId) {
                        return c;
                    }
                    cmd = c;
                    return {
                        ...c,
                        taskId: null,
                        err: err
                    };
                }),
                runningTasks: _without(this.state.runningTasks, taskId)
            });

            if (cmd && this.state.pushPermission === Push.Permission.GRANTED) {
                Push.create(cmd.title, {
                    body: i18n._('Command failed ({{err}})', { err: err }),
                    icon: 'images/logo-badge-32x32.png',
                    timeout: 10 * 1000,
                    onClick: function () {
                        window.focus();
                        this.close();
                    }
                });
            }
        }
    };

    _isMounted = false;

    getInitialState() {
        let pushPermission = '';
        try {
            // Push.Permission.get() will throw an error if Push is not supported on this device
            pushPermission = Push.Permission.get();
        } catch (e) {
            // Ignore
        }

        return {
            pushPermission: pushPermission,
            commands: [],
            runningTasks: [],
            currentVersion: settings.version,
            latestVersion: settings.version
        };
    }

    componentDidMount() {
        this._isMounted = true;

        this.addActionHandlers();
        this.addControllerEvents();

        // Initial actions
        this.actions.checkForUpdates();
        this.actions.fetchCommands();
    }

    componentWillUnmount() {
        this._isMounted = false;

        this.removeActionHandlers();
        this.removeControllerEvents();

        this.runningTasks = [];
    }

    addActionHandlers() {
        Object.keys(this.actionHandlers).forEach(eventName => {
            const callback = this.actionHandlers[eventName];
            combokeys.on(eventName, callback);
        });
    }

    removeActionHandlers() {
        Object.keys(this.actionHandlers).forEach(eventName => {
            const callback = this.actionHandlers[eventName];
            combokeys.removeListener(eventName, callback);
        });
    }

    addControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.addListener(eventName, callback);
        });
    }

    removeControllerEvents() {
        Object.keys(this.controllerEvents).forEach(eventName => {
            const callback = this.controllerEvents[eventName];
            controller.removeListener(eventName, callback);
        });
    }

    render() {
        const { history, location } = this.props;
        const { currentVersion, latestVersion } = this.state;
        const newUpdateAvailable = semver.lt(currentVersion, latestVersion);
        const sessionEnabled = config.get('session.enabled');
        const signedInName = config.get('session.name');

        return (
            <Container fluid>
                <Row
                    style={{
                        height: 50,
                        justifyContent: 'space-between',
                    }}
                >
                    <Col
                        width="auto"
                        style={{
                            textAlign: 'center',
                            width: 60,
                        }}
                    >
                        <Anchor
                            href={releases}
                            target="_blank"
                            title={`${settings.productName} ${settings.version}`}
                        >
                            <Hoverable>
                                {(hovered) => (
                                    <Row
                                        style={{
                                            flexDirection: 'column',
                                            height: '100%',
                                            paddingTop: 4,
                                            cursor: hovered ? 'pointer' : 'default',
                                        }}
                                    >
                                        <Col width="auto">
                                            <Image src={logo} width={32} height={32} />
                                        </Col>
                                        <Col>
                                            <Text
                                                color={hovered ? '#fff' : '#9d9d9d'}
                                                size="50%"
                                                style={{
                                                    lineHeight: 1,
                                                    margin: '2px 0',
                                                    verticalAlign: 'top',
                                                }}
                                            >
                                                {settings.version}
                                            </Text>
                                        </Col>
                                    </Row>
                                )}
                            </Hoverable>
                            {newUpdateAvailable && (
                                <Tooltip content={i18n._('New update available')}>
                                    <Badge
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            right: 0,
                                            backgroundColor: '#007bff',
                                            color: '#fff',
                                            cursor: 'default',
                                        }}
                                    >
                                        N
                                    </Badge>
                                </Tooltip>
                            )}
                        </Anchor>
                    </Col>
                    <Col
                        width="auto"
                        style={{
                            display: 'flex',
                        }}
                    >
                        {sessionEnabled &&
                        <Dropdown
                            pullRight
                        >
                            <Dropdown.Toggle
                                componentClass={UserDropdownToggle}
                                btnStyle="dark"
                            >
                                <FontAwesomeIcon icon="user" />
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                                <MenuItem header>
                                    {i18n._('Signed in as {{name}}', { name: signedInName })}
                                </MenuItem>
                                <MenuItem divider />
                                <MenuItem
                                    onClick={() => {
                                        history.push('/settings/account');
                                    }}
                                >
                                    <FontAwesomeIcon icon="user" fixedWidth />
                                    <Space width="8" />
                                    {i18n._('Account')}
                                </MenuItem>
                                <MenuItem
                                    onClick={() => {
                                        if (user.isAuthenticated()) {
                                            log.debug('Destroy and cleanup the WebSocket connection');
                                            controller.disconnect();

                                            user.signout();

                                            // Remember current location
                                            history.replace(location.pathname);
                                        }
                                    }}
                                >
                                    <FontAwesomeIcon icon="sign-out-alt" fixedWidth />
                                    <Space width="8" />
                                    {i18n._('Sign Out')}
                                </MenuItem>
                            </Dropdown.Menu>
                        </Dropdown>
                        }
                    </Col>
                </Row>
            </Container>
        );
    }

    /*
    render() {
        const { history, location } = this.props;
        const { pushPermission, commands, runningTasks, currentVersion, latestVersion } = this.state;
        const newUpdateAvailable = semver.lt(currentVersion, latestVersion);
        const tooltip = newUpdateAvailable ? newUpdateAvailableTooltip() : <div />;
        const sessionEnabled = config.get('session.enabled');
        const signedInName = config.get('session.name');
        const hideUserDropdown = !sessionEnabled;
        const showCommands = commands.length > 0;

        return (
            <Navbar
                fixedTop
                fluid
                inverse
                style={{
                    border: 'none',
                    margin: 0,
                    height: 50,
                }}
            >
                <Navbar.Header>
                    <OverlayTrigger
                        overlay={tooltip}
                        placement="right"
                    >
                        <Anchor
                            className="navbar-brand"
                            style={{
                                padding: 0,
                                position: 'relative',
                                height: 50,
                                width: 60
                            }}
                            href={releases}
                            target="_blank"
                            title={`${settings.productName} ${settings.version}`}
                        >
                            <img
                                style={{
                                    margin: '4px auto 0 auto'
                                }}
                                src="images/logo-badge-32x32.png"
                                alt=""
                            />
                            <div
                                style={{
                                    fontSize: '50%',
                                    lineHeight: '14px',
                                    textAlign: 'center'
                                }}
                            >
                                {settings.version}
                            </div>
                            {newUpdateAvailable &&
                            <span
                                className="label label-primary"
                                style={{
                                    fontSize: '50%',
                                    position: 'absolute',
                                    top: 2,
                                    right: 2
                                }}
                            >
                                N
                            </span>
                            }
                        </Anchor>
                    </OverlayTrigger>
                    <Navbar.Toggle />
                </Navbar.Header>
                <Navbar.Collapse>
                    <Nav pullRight>
                        <NavDropdown
                            className={classNames(
                                { 'hidden': hideUserDropdown }
                            )}
                            id="nav-dropdown-user"
                            title={
                                <div title={i18n._('My Account')}>
                                    <i className="fa fa-fw fa-user" />
                                </div>
                            }
                            noCaret
                        >
                            <MenuItem header>
                                {i18n._('Signed in as {{name}}', { name: signedInName })}
                            </MenuItem>
                            <MenuItem divider />
                            <MenuItem
                                href="#/settings/account"
                            >
                                <i className="fa fa-fw fa-user" />
                                <Space width="8" />
                                {i18n._('Account')}
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    if (user.isAuthenticated()) {
                                        log.debug('Destroy and cleanup the WebSocket connection');
                                        controller.disconnect();

                                        user.signout();

                                        // Remember current location
                                        history.replace(location.pathname);
                                    }
                                }}
                            >
                                <i className="fa fa-fw fa-sign-out" />
                                <Space width="8" />
                                {i18n._('Sign Out')}
                            </MenuItem>
                        </NavDropdown>
                        <NavDropdown
                            id="nav-dropdown-menu"
                            title={
                                <div title={i18n._('Options')}>
                                    <i className="fa fa-fw fa-ellipsis-v" />
                                    {this.state.runningTasks.length > 0 &&
                                    <span
                                        className="label label-primary"
                                        style={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4
                                        }}
                                    >
                                        N
                                    </span>
                                    }
                                </div>
                            }
                            noCaret
                        >
                            {showCommands &&
                            <MenuItem header>
                                {i18n._('Command')}
                                {pushPermission === Push.Permission.GRANTED &&
                                <span className="pull-right">
                                    <i className="fa fa-fw fa-bell-o" />
                                </span>
                                }
                                {pushPermission === Push.Permission.DENIED &&
                                <span className="pull-right">
                                    <i className="fa fa-fw fa-bell-slash-o" />
                                </span>
                                }
                                {pushPermission === Push.Permission.DEFAULT &&
                                <span className="pull-right">
                                    <Anchor
                                        className={styles.btnIcon}
                                        onClick={this.actions.requestPushPermission}
                                        title={i18n._('Show notifications')}
                                    >
                                        <i className="fa fa-fw fa-bell" />
                                    </Anchor>
                                </span>
                                }
                            </MenuItem>
                            }
                            {showCommands && commands.map((cmd) => {
                                const isTaskRunning = runningTasks.indexOf(cmd.taskId) >= 0;

                                return (
                                    <MenuItem
                                        key={cmd.id}
                                        disabled={cmd.disabled}
                                        onSelect={() => {
                                            this.actions.runCommand(cmd);
                                        }}
                                    >
                                        <span title={cmd.command}>{cmd.title || cmd.command}</span>
                                        <span className="pull-right">
                                            <i
                                                className={classNames(
                                                    'fa',
                                                    'fa-fw',
                                                    { 'fa-circle-o-notch': isTaskRunning },
                                                    { 'fa-spin': isTaskRunning },
                                                    { 'fa-exclamation-circle': cmd.err },
                                                    { 'text-error': cmd.err }
                                                )}
                                                title={cmd.err}
                                            />
                                        </span>
                                    </MenuItem>
                                );
                            })}
                            {showCommands &&
                            <MenuItem divider />
                            }
                            <MenuItem
                                href="https://github.com/cncjs/cncjs/wiki"
                                target="_blank"
                            >
                                {i18n._('Help')}
                            </MenuItem>
                            <MenuItem
                                href="https://github.com/cncjs/cncjs/issues"
                                target="_blank"
                            >
                                {i18n._('Report an issue')}
                            </MenuItem>
                        </NavDropdown>
                    </Nav>
                    {location.pathname === '/workspace' &&
                    <QuickAccessToolbar state={this.state} actions={this.actions} />
                    }
                </Navbar.Collapse>
            </Navbar>
        );
    }
    */
}

export default withRouter(Header);
