import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  FileText,
  Grid3x3,
  History,
  Home,
  Link2,
  ListOrdered,
  Menu,
  ScanSearch,
  Settings,
  Target,
  UserPlus,
} from 'lucide-react';
import { useAppState } from '../state/AppState';
import Drawer from './Drawer';
import styles from './Shell.module.css';

const MAIN = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/add-patient', label: 'Add patient', icon: UserPlus, step: 1, tour: 'add' },
  { to: '/check-risk', label: 'Check risk', icon: ScanSearch, step: 2, tour: 'check' },
  { to: '/accuracy', label: 'Model accuracy', icon: Target, step: 3, tour: 'accuracy' },
];
const TOOLS = [
  { to: '/waiting-list', label: 'Waiting list', icon: ListOrdered },
  { to: '/report', label: 'Patient report', icon: FileText },
];
const HOW = [
  { to: '/linked-list', label: 'Patient list (linked list)', icon: Link2 },
  { to: '/hash-table', label: 'Gene lookup (hash table)', icon: Grid3x3 },
];
const START = { to: '/start', label: 'Start / Settings', icon: Settings, tour: 'start' };

function NavItem({ item, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      data-tour={item.tour}
      className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
    >
      <Icon size={20} strokeWidth={2} aria-hidden="true" />
      <span className={styles.navLabel}>{item.label}</span>
      {item.step && (
        <span className={styles.step} aria-label={`step ${item.step}`}>
          {item.step}
        </span>
      )}
    </NavLink>
  );
}

function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true" />
        <span>
          <strong>Cancer Risk Checker</strong>
          <span className={styles.brandSub}>4 AI models from scratch</span>
        </span>
      </div>
      <nav aria-label="Main" className={styles.nav}>
        <ul className={styles.navList}>
          {MAIN.map((item) => (
            <li key={item.to}>
              <NavItem item={item} />
            </li>
          ))}
        </ul>
        <h2 className={styles.group} id="nav-tools">Tools</h2>
        <ul className={styles.navList} aria-labelledby="nav-tools">
          {TOOLS.map((item) => (
            <li key={item.to}>
              <NavItem item={item} />
            </li>
          ))}
        </ul>
        <h2 className={styles.group} id="nav-how">How it works</h2>
        <ul className={styles.navList} aria-labelledby="nav-how">
          {HOW.map((item) => (
            <li key={item.to}>
              <NavItem item={item} />
            </li>
          ))}
        </ul>
        <ul className={`${styles.navList} ${styles.navBottom}`}>
          <li>
            <NavItem item={START} />
          </li>
        </ul>
      </nav>
    </aside>
  );
}

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/add-patient', label: 'Add', icon: UserPlus, tour: 'add' },
  { to: '/check-risk', label: 'Check', icon: ScanSearch, tour: 'check' },
  { to: '/accuracy', label: 'Accuracy', icon: Target, tour: 'accuracy' },
];

function BottomTabs() {
  const [more, setMore] = useState(false);
  const location = useLocation();
  const moreActive = [...TOOLS, ...HOW, START].some((i) => location.pathname.startsWith(i.to));
  return (
    <>
      <nav aria-label="Main" className={styles.tabbar}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              data-tour={tab.tour}
              className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
            >
              <Icon size={22} aria-hidden="true" />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          className={`${styles.tab} ${moreActive ? styles.tabActive : ''}`}
          onClick={() => setMore(true)}
          data-tour="start-mobile"
          aria-haspopup="dialog"
        >
          <Menu size={22} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>
      <Drawer open={more} side="bottom" title="More" onClose={() => setMore(false)}>
        <ul className={styles.moreList}>
          {[...TOOLS, ...HOW, START].map((item) => (
            <li key={item.to}>
              <NavItem item={item} onClick={() => setMore(false)} />
            </li>
          ))}
        </ul>
      </Drawer>
    </>
  );
}

function ActivityPanel({ open, onClose }) {
  const { state } = useAppState();
  const entries = state.activity;

  const exportLog = () => {
    const lines = entries.map((e) => `${e.time}  ${e.text}`);
    const blob = new Blob([`Activity\n\n${lines.join('\n')}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'activity.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Drawer
      open={open}
      title="Activity"
      onClose={onClose}
      headerExtra={
        <button type="button" className="btn" onClick={exportLog} disabled={entries.length === 0}>
          Export
        </button>
      }
    >
      {entries.length === 0 ? (
        <p className="hint">Nothing yet. Loading data, adding patients and checking risk are listed here.</p>
      ) : (
        <ol className={styles.activity}>
          {[...entries].reverse().map((e) => (
            <li key={e.id}>
              <time className={styles.time}>{e.time}</time>
              <span>{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}

function TopBar({ onActivity }) {
  const { state } = useAppState();
  const count = state.activity.length;
  return (
    <div className={styles.topbar}>
      <button type="button" className={styles.activityButton} onClick={onActivity} aria-haspopup="dialog">
        <History size={20} aria-hidden="true" />
        <span>Activity</span>
        {count > 0 && (
          <span className={styles.badge} aria-label={`${count} events`}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    </div>
  );
}

// Shown on every screen except Start when the server is off or no data is loaded
function DataBanner() {
  const { state, refresh } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  // Start loads the data itself; Home shows the same action as step 1
  if (location.pathname === '/start' || location.pathname === '/') return null;
  if (state.server === 'offline') {
    return (
      <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
        <span>The server is not running. Start cds_server and press Retry.</span>
        <button type="button" className="btn" onClick={refresh}>
          Retry
        </button>
      </div>
    );
  }
  if (state.server === 'online' && !state.status.modelsTrained) {
    return (
      <div className={styles.banner} role="status">
        <span>Data not loaded yet.</span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/start', { state: { autoLoad: true } })}
        >
          Load data
        </button>
      </div>
    );
  }
  return null;
}

function Toasts() {
  const { state, dismissToast } = useAppState();
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const timers = state.toasts.map((t) => setTimeout(() => dismissToast(t.id), 3500));
    return () => timers.forEach(clearTimeout);
  }, [state.toasts, dismissToast]);
  return (
    <div className={styles.toasts} role="status" aria-live="polite">
      <AnimatePresence>
        {state.toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`${styles.toast} ${t.tone === 'error' ? styles.toastError : ''}`}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function Shell({ children }) {
  const [activity, setActivity] = useState(false);
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <Sidebar />
      <div className={styles.workspace}>
        <TopBar onActivity={() => setActivity(true)} />
        <main id="main" className={styles.main} tabIndex={-1}>
          <DataBanner />
          {children}
        </main>
      </div>
      <BottomTabs />
      <ActivityPanel open={activity} onClose={() => setActivity(false)} />
      <Toasts />
    </div>
  );
}
