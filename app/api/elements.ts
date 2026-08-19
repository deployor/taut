// Taut Elements Registry
// Central place to find Slack's React components

import { findComponentPromise, reactPromise } from '../slack/react'

export type SvgIconProps = {
  name: string
  size?: number
  inline?: boolean
}

export type MrkdwnElementProps = {
  text: string
}

export type ButtonProps = {
  type?: 'primary' | 'ghost' | 'outline' | 'danger'
  size?: 'small' | 'medium' | 'large'
  icon?: string
  href?: string
  htmlType?: 'button' | 'submit' | 'reset'
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'size'>

export type TooltipProps = {
  tip: string
  position?: string
  offsetY?: number
  delay?: number
  zIndex?: string
  children?: React.ReactNode
}

export type IconButtonBaseProps = {
  size?: string
  className?: string
  'aria-pressed'?: string
  'aria-label'?: string
  'data-qa'?: string
  onClick?: () => void
  tabIndex?: number
  children?: React.ReactNode
}

export type ConfirmationModalProps = {
  title?: React.ReactNode
  children?: React.ReactNode
  onSubmit?: () => void
  onCancel?: () => void
  onClose?: () => void
  submitButtonText?: string
  cancelButtonText?: string
  submitButtonType?: 'primary' | 'danger'
  showCancelButton?: boolean
  showSubmitButton?: boolean
  disableSubmitButton?: boolean
}

/** the error line under a form field, warning icon included */
export type InlineAlertProps = {
  children?: React.ReactNode
  className?: string
  id?: string
}

export type LabelProps = {
  text: React.ReactNode
  htmlFor?: string
  subtext?: React.ReactNode
  optional?: boolean
  type?: 'block' | 'inline'
  isDisabled?: boolean
  className?: string
  id?: string
}

/** One row of a Slack menu */
export type MenuTemplateItem = {
  key: string
  label?: React.ReactNode
  description?: React.ReactNode
  type?: 'submenu' | 'separator' | 'header' | 'custom'
  /** the rows of a `submenu` item */
  template?: MenuTemplateItem[]
  /** an `SvgIcon` name */
  icon?: string
  click?: (e?: unknown) => void
  disabled?: boolean
  danger?: boolean
}

/**
 * Slack's two-field date range control, with a calendar popover.
 * Dates are strings in `dateFormat`, which defaults to YYYY-MM-DD.
 */
export type DateRangePickerProps = {
  id?: string
  className?: string
  /** initial value only: the picker is uncontrolled after mount */
  selectedStartDate?: string | null
  selectedEndDate?: string | null
  /** the picker manages its own state; these only report the new value */
  onStartDateChange?: (change: { selectedStartDate: string }) => void
  onEndDateChange?: (change: { selectedEndDate: string }) => void
  /** how dates are parsed and reported back, e.g. "YYYY-MM-DD" */
  dateFormat?: string
  /** how dates are shown, when it should differ from `dateFormat` */
  displayFormat?: string | null
  disabledDates?: string[]
  disableDatesBefore?: string
  disableDatesAfter?: string
  /** cap the span the user can pick, in days */
  maxRange?: number
  size?: 'small' | 'medium' | 'large'
  width?: number | null
  placeholderText?: string | null
  startInputPlaceholder?: string
  endInputPlaceholder?: string
  startInputAriaLabel?: string
  endInputAriaLabel?: string
  showClearSelection?: boolean
  endDateRequired?: boolean
  singleMonthMode?: boolean
  showPreviousMonth?: boolean
  closeAfterSelection?: boolean
  renderCalendarInPopover?: boolean
  onCalendarClose?: () => void
  dataQa?: string | null
  'aria-label'?: string
}

/** Slack's section wrapper: a FieldSet holding a Legend and its controls */
export type FieldSetProps = {
  id?: string
  'data-qa'?: string
  'data-qa-section'?: string
  children?: React.ReactNode
}

export type LegendProps = {
  className?: string
  children?: React.ReactNode
}

/** Secondary line under a control */
export type HintProps = {
  children?: React.ReactNode
  className?: string
}

/** One option in a BasicSelect */
export type SelectOption = { label: string; value: string }

export type BasicSelectProps = {
  selectId: string
  options: SelectOption[]
  selectedOption?: SelectOption
  onSelectionChange: (option: SelectOption) => void
  width?: number
  ariaLabel?: string
  selectDataQa?: string
  isDisabled?: boolean
}

export type BlocksProps = {
  msg: { blocks?: unknown[]; [key: string]: unknown }
  blocksContainerContext?: 'message' | string
  streaming?: boolean
}

export type MenuFromTemplateProps = { template?: MenuTemplateItem[] }

export type MenuTriggerProps = {
  position?: 'top' | 'bottom' | 'left' | 'right'
  isDisabled?: boolean
  renderMenu: (menuProps: object) => React.ReactNode
  children?: React.ReactNode
}

export type FormTextInputProps = {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  onFocus?: React.FocusEventHandler<HTMLInputElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  placeholder?: string
  hintText?: string | null
  errorText?: string | null
  isDisabled?: boolean
  isInvalid?: boolean
  isRequired?: boolean
  size?: 'small' | 'medium' | 'large'
  autoFocus?: boolean
  autoComplete?: string
  maxCharacterLimit?: number | null
  className?: string
}

// A component that renders nothing and logs once, for when a lookup fails
function missingElement<P extends {}>(name: string): React.ComponentType<P> {
  let warned = false
  return function TautMissingElement() {
    if (!warned) {
      warned = true
      console.error(`[Taut] Elements: "${name}" is unavailable`)
    }
    return null
  }
}

export const elementsAPIPromise = (async () => {
  await reactPromise
  const findComponent = await findComponentPromise

  function resolve<P extends {}>(name: string): React.ComponentType<P> {
    try {
      return findComponent<P>(name)
    } catch (err) {
      console.error(`[Taut] Elements: could not resolve "${name}"`, err)
      return missingElement<P>(name)
    }
  }

  return {
    SvgIcon: resolve<SvgIconProps>('SvgIcon'),
    MrkdwnElement: resolve<MrkdwnElementProps>('MrkdwnElement'),
    Button: resolve<ButtonProps>('Button'),
    Tooltip: resolve<TooltipProps>('Tooltip'),
    IconButtonBase: resolve<IconButtonBaseProps>('IconButtonBase'),
    ConfirmationModal: resolve<ConfirmationModalProps>('ConfirmationModal'),
    InlineAlert: resolve<InlineAlertProps>('InlineAlert'),
    Label: resolve<LabelProps>('Label'),
    FormTextInput: resolve<FormTextInputProps>('FormTextInput'),
    DateRangePicker: resolve<DateRangePickerProps>('DateRangePicker'),
    FieldSet: resolve<FieldSetProps>('FieldSet'),
    Legend: resolve<LegendProps>('Legend'),
    Hint: resolve<HintProps>('Hint'),
    BasicSelect: resolve<BasicSelectProps>('BasicSelect'),
    Blocks: resolve<BlocksProps>('Blocks'),
    MenuTrigger: resolve<MenuTriggerProps>('MenuTrigger'),
    MenuFromTemplate: resolve<MenuFromTemplateProps>('MenuFromTemplate'),
  }
})()

export type ElementsAPI = Awaited<typeof elementsAPIPromise>
