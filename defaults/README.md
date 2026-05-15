# KasmVNC Defaults Directory

This directory contains default configuration files for the KasmVNC desktop environment.

## Files

### `autostart`
Applications and commands that automatically execute when the desktop environment starts.

**Current configuration:**
```bash
xsetroot -solid blue
```

- **`xsetroot -solid blue`**: Sets the desktop background to solid blue

The Playwright MCP server is started automatically via the s6 service at `/etc/services.d/playwright/run`, not from autostart.

### `menu.xml`
Defines the right-click context menu for the desktop environment using OpenBox menu format.

**Current menu items:**
- **xterm**: Opens a terminal window (`/usr/bin/xterm`)
- **chrome**: Launches Google Chrome browser (`/usr/bin/google-chrome`)

## Customization

### Adding Applications to Autostart
Edit `autostart` to include additional commands that should run when the desktop loads:
```bash
xsetroot -solid blue
# Add your commands here
/usr/bin/your-application &
```

### Modifying Desktop Menu
Edit `menu.xml` to add, remove, or modify menu items:
```xml
<item label="My App" icon="/path/to/icon.png">
    <action name="Execute">
        <command>/path/to/my-application</command>
    </action>
</item>
```

## KasmVNC Integration

These files integrate with the KasmVNC base image to provide:
- Automatic service startup
- User-friendly desktop interface
- Quick access to essential applications

The configuration ensures the MCP server starts automatically and provides easy access to Chrome for manual browser interaction.
