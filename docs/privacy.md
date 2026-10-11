# Privacy — local preview build

This version of Sacramentum is a single-player static browser game. It has no account system, backend, advertising, payment integration or analytics endpoint. No player identifier or campaign data is intentionally sent to a game service.

Progress and settings are stored in your browser on the device where you play. Browser settings, storage limits, clearing site data or private browsing can affect whether they survive. The save export feature lets you keep a separate copy and move progress to another device. A save code contains campaign progress and the name entered for the protagonist; treat it as something you choose to disclose, rather than a secret encrypted backup.

The game may request persistent storage permission and use a service worker to keep game files available offline. These are browser features. Installation and persistent-storage support depend on the browser, and the browser can still apply its own storage rules.

An end-of-game reign card is generated on your device. Sharing starts only when you choose a share or download control. A native share sheet passes the selected card or link to the destination you select; that destination has its own privacy practices. The game does not receive proof that you posted the card.

Opening a hosted version necessarily requests files from its hosting provider. That provider may receive IP addresses and routine access-log information. No production host or analytics provider has been configured or evaluated for this local preview. Before public launch, replace this preview notice with one identifying the actual hosting provider, its retention practices, contact details, and any additional services. Adding analytics, purchases, advertising or email collection requires updating the notice before those features are enabled.

This notice describes the intended data flows of this build. Browser/device verification is reported separately in the verification document; it is not a claim that every browser's storage behaviour has been tested.
