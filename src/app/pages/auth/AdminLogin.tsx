import RoleLoginPage from "./RoleLoginPage";
// SECURITY NOTE: This page MUST call authService.login() and pass real tokens to setAuthSession().
// Never call setAuthSession() with only role+identifier in production.
export default function AdminLogin() { return <RoleLoginPage role="admin" />; }
