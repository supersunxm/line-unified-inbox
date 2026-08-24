# Mobile admin username login hotfix

The backend password authenticator already resolves either normalized email or username. The mobile login DTO previously rejected non-email identifiers before the authenticator ran, preventing username-only HQ/admin accounts from signing in to the app.

This hotfix keeps the existing mobile request field (`email`) for backward compatibility while validating it as a non-empty identifier instead of an email address. The Flutter login field is also presented as Email / Username and uses a normal text keyboard.
