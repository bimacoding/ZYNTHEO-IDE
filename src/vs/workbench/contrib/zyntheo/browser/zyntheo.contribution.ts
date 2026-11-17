/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/


// register inline diffs
import './editCodeService.js'

// Legacy Void command ID aliases (keybinding compatibility)
import './legacyCommandAliases.js'

// register Sidebar pane, state, actions (keybinds, menus) (Ctrl+L)
import './sidebarActions.js'
import './sidebarPane.js'

// register quick edit (Ctrl+K)
import './quickEditActions.js'


// register Autocomplete
import './autocompleteService.js'

// register Context services
// import './contextGatheringService.js'
// import './contextUserChangesService.js'

// settings pane
import './zyntheoSettingsPane.js'

// register css
import './media/zyntheo.css'

// update (frontend part, also see platform/)
import './zyntheoUpdateActions.js'

import './convertToLLMMessageWorkbenchContrib.js'

// tools
import './toolsService.js'
import './terminalToolService.js'

// register Thread History
import './chatThreadService.js'

// ping
import './metricsPollService.js'

// helper services
import './helperServices/consistentItemService.js'

// register selection helper
import './zyntheoSelectionHelperWidget.js'

// register tooltip service
import './tooltipService.js'

// register onboarding service
import './zyntheoOnboardingService.js'

// register misc service
import './miscWokrbenchContrib.js'

// Void → Zyntheo user data migration (non-destructive)
import './userDataMigrationService.js'

// register file service (for explorer context menu)
import './fileService.js'

// register source control management
import './zyntheoSCMService.js'

// ---------- common (unclear if these actually need to be imported, because they're already imported wherever they're used) ----------

// llmMessage
import '../common/sendLLMMessageService.js'

// zyntheoSettings
import '../common/zyntheoSettingsService.js'

// refreshModel
import '../common/refreshModelService.js'

// metrics
import '../common/metricsService.js'

// updates
import '../common/zyntheoUpdateService.js'

// model service
import '../common/zyntheoModelService.js'
