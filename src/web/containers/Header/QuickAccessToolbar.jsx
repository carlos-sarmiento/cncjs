import pubsub from 'pubsub-js';
import React, { Component, PropTypes } from 'react';
import controller from '../../lib/controller';
import i18n from '../../lib/i18n';
import {
    WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATE_PAUSED
} from '../../constants';
import styles from './index.styl';

class QuickAccessToolbar extends Component {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    handleCycleStart() {
        const { state } = this.props;

        if (state.workflowState === WORKFLOW_STATE_PAUSED) {
            pubsub.publish('workflowState', WORKFLOW_STATE_RUNNING);
        }
        controller.command('cyclestart');
    }
    handleFeedHold() {
        const { state } = this.props;

        if (state.workflowState === WORKFLOW_STATE_RUNNING) {
            pubsub.publish('workflowState', WORKFLOW_STATE_PAUSED);
        }
        controller.command('feedhold');
    }
    handleHoming() {
        controller.command('homing');
    }
    handleSleep() {
        controller.command('sleep');
    }
    handleUnlock() {
        controller.command('unlock');
    }
    handleReset() {
        controller.command('reset');
    }
    render() {
        return (
            <div className={styles.quickAccessToolbar}>
                <ul className="nav navbar-nav">
                    <li className="btn-group btn-group-sm" role="group">
                        <button
                            type="button"
                            className="btn btn-default"
                            onClick={::this.handleCycleStart}
                            title={i18n._('Cycle Start')}
                        >
                            <i className="fa fa-repeat" />
                            <span className="space" />
                            {i18n._('Cycle Start')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-default"
                            onClick={::this.handleFeedHold}
                            title={i18n._('Feedhold')}
                        >
                            <i className="fa fa-hand-paper-o" />
                            <span className="space" />
                            {i18n._('Feedhold')}
                        </button>
                    </li>
                    <li className="btn-group btn-group-sm" role="group">
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={::this.handleHoming}
                            title={i18n._('Homing')}
                        >
                            <i className="fa fa-home" />
                            <span className="space" />
                            {i18n._('Homing')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-success"
                            onClick={::this.handleSleep}
                            title={i18n._('Sleep')}
                        >
                            <i className="fa fa-bed" />
                            <span className="space" />
                            {i18n._('Sleep')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-warning"
                            onClick={::this.handleUnlock}
                            title={i18n._('Unlock')}
                        >
                            <i className="fa fa-unlock-alt" />
                            <span className="space" />
                            {i18n._('Unlock')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={::this.handleReset}
                            title={i18n._('Reset')}
                        >
                            <i className="fa fa-undo" />
                            <span className="space" />
                            {i18n._('Reset')}
                        </button>
                    </li>
                </ul>
            </div>
        );
    }
}

export default QuickAccessToolbar;
