// src/App.jsx
// Auth gate — shows AuthScreen when logged out, TheBrain when logged in.
// Also handles the initial "load all user data from API" on login.

import { useState, useEffect } from "react";
import { token, auth as authApi, projects as projectsApi, staging as stagingApi, ideas as ideasApi, areas as areasApi, goals as goalsApi, templates as templatesApi, tags as tagsApi } from "./api.js";
import AuthScreen from "./AuthScreen.jsx";
import TheBrain from "./TheBrain.jsx";

export default function App() {
  const [user, setUser]         = useState(null);
  const [appData, setAppData]   = useState(null);  // { projects, staging, ideas, areas }
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  // On mount — check if we have a valid token
  useEffect(() => {
    const t = token.get();
    if (!t) { setLoading(false); return; }
    bootstrap();
  }, []);

  // Called after login/register OR on mount if token exists
  const bootstrap = async () => {
    setLoading(true);
    setError("");
    try {
      // Verify token + get user
      const { user } = await authApi.me();
      setUser(user);

      // Load all data with individual error handling to prevent one failure from blocking all
      const safeFetch = async (apiCall, fallback) => {
        try {
          return await apiCall();
        } catch (e) {
          console.error("Bootstrap fetch error:", e);
          return fallback;
        }
      };

      const [projRes, stagingRes, ideasRes, areasRes, goalsRes, templatesRes, tagsRes, entityTagsRes] = await Promise.all([
        safeFetch(() => projectsApi.list(), { projects: [] }),
        safeFetch(() => stagingApi.list(), { staging: [] }),
        safeFetch(() => ideasApi.list(), { ideas: [] }),
        safeFetch(() => areasApi.list(), { areas: [] }),
        safeFetch(() => goalsApi.list(), { goals: [] }),
        safeFetch(() => templatesApi.list(), { templates: [] }),
        safeFetch(() => tagsApi.list(), { tags: [] }),
        safeFetch(() => tagsApi.listEntityTags(), { entity_tags: [] }),
      ]);

      setAppData({
        projects:    projRes.projects || [],
        staging:     stagingRes.staging || [],
        ideas:       ideasRes.ideas || [],
        areas:       areasRes.areas || [],
        goals:       goalsRes.goals || [],
        templates:   templatesRes.templates || [],
        tags:        tagsRes.tags || [],
        entityTags:  entityTagsRes.entity_tags || [],
      });
    } catch (e) {
      // Token expired or invalid — clear it
      console.error("Bootstrap auth error:", e);
      token.clear();
      setUser(null);
      setAppData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (authedUser) => {
    setUser(authedUser);
    await bootstrap();
  };

  const handleLogout = () => {
    authApi.logout();
    setUser(null);
    setAppData(null);
  };

  // ── LOADING ───────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        fontFamily:"'JetBrains Mono','Fira Code',monospace",
        background:"#070b14", color:"#334155",
        minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
        flexDirection:"column", gap:12,
      }}>
        <div style={{fontSize:36}}>🧠</div>
        <div style={{fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase"}}>
          Loading...
        </div>
      </div>
    );
  }

  // ── NOT AUTHED ────────────────────────────────────────────
  if (!user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  // ── AUTHED ────────────────────────────────────────────────
  return (
    <TheBrain
      user={user}
      initialProjects={appData?.projects || []}
      initialStaging={appData?.staging || []}
      initialIdeas={appData?.ideas || []}
      initialAreas={appData?.areas || []}
      initialGoals={appData?.goals || []}
      initialTemplates={appData?.templates || []}
      initialTags={appData?.tags || []}
      initialEntityTags={appData?.entityTags || []}
      onLogout={handleLogout}
    />
  );
}
