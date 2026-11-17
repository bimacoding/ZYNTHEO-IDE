/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { ZyntheoCommandBarMain } from './ZyntheoCommandBar.js'
import { ZyntheoSelectionHelperMain } from './ZyntheoSelectionHelper.js'

export const mountZyntheoCommandBar = mountFnGenerator(ZyntheoCommandBarMain)

export const mountZyntheoSelectionHelper = mountFnGenerator(ZyntheoSelectionHelperMain)

