import { Link } from "react-router-dom";
import { FiActivity, FiTarget, FiTrendingUp, FiZap } from "react-icons/fi";

const HIGHLIGHTS = [
  {
    icon: <FiTarget />,
    title: "Plans That Fit Real Life",
    text: "Smart workout and meal plans tuned to your schedule, goals, and progress.",
  },
  {
    icon: <FiTrendingUp />,
    title: "Data-Driven Tracking",
    text: "Monitor consistency, calorie balance, and body metrics with clear trends.",
  },
  {
    icon: <FiZap />,
    title: "AI Fitness Assistant",
    text: "Get instant coaching tips, posture guidance, and personalized recommendations.",
  },
];

export default function OpeningPage() {
  return (
    <main className="opening-page">
      <div className="opening-grid">
        <section className="opening-hero">
          <p className="opening-kicker">FLEXA PERFORMANCE SYSTEM</p>
          <h1 className="opening-title">
            Build your strongest self
            <span> with focused AI coaching.</span>
          </h1>
          <p className="opening-subtitle">
            Train smarter, eat better, and stay consistent with one unified
            fitness platform designed for momentum.
          </p>

          <div className="opening-cta-row">
            <Link to="/register" className="btn btn-gold opening-cta-primary">
              Create Account
            </Link>
            <Link to="/login" className="btn btn-outline opening-cta-secondary">
              Sign In
            </Link>
          </div>

          <div
            className="opening-metrics"
            aria-label="Performance metrics preview"
          >
            <div className="opening-metric-card">
              <p>Goal Streak</p>
              <strong>28 Days</strong>
            </div>
            <div className="opening-metric-card">
              <p>Weekly Sessions</p>
              <strong>5 / 7</strong>
            </div>
            <div className="opening-metric-card">
              <p>Energy Score</p>
              <strong>92%</strong>
            </div>
          </div>
        </section>

        <section className="opening-panel" aria-label="Flexa features">
          <div className="opening-panel-head">
            <span className="opening-panel-icon">
              <FiActivity />
            </span>
            <h2>Start Your Flexa Journey</h2>
          </div>

          <div className="opening-highlight-list">
            {HIGHLIGHTS.map((item) => (
              <article key={item.title} className="opening-highlight-card">
                <div className="opening-highlight-icon">{item.icon}</div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>

          <p className="opening-login-hint">
            Already part of Flexa? <Link to="/login">Sign in here</Link>.
          </p>
        </section>
      </div>

      <div className="opening-bg opening-bg-one" aria-hidden="true" />
      <div className="opening-bg opening-bg-two" aria-hidden="true" />
      <div className="opening-noise" aria-hidden="true" />
    </main>
  );
}
