import type { AccountClassification } from '@prisma/client'

import { Controller } from 'react-hook-form'
import { InputCurrency, DatePicker } from '@maybe-finance/design-system'
import { BrowserUtil } from '@maybe-finance/client/shared'

export type AccountValuationFieldProps = {
    control: any
    classification?: AccountClassification
    currentBalanceEditable?: boolean
}

export function AccountValuationFormFields({
    control,
    classification = 'asset',
    currentBalanceEditable = true,
}: AccountValuationFieldProps) {
    return (
        <>
            <Controller
                control={control}
                name="startDate"
                rules={{ validate: BrowserUtil.validateFormDate }}
                render={({ field, fieldState: { error } }) => (
                    <DatePicker
                        label={classification === 'liability' ? 'Origin date' : 'Purchase date'}
                        error={error?.message}
                        popperPlacement="top"
                        {...field}
                    />
                )}
            />

            <div className="flex gap-4 my-4">
                <Controller
                    control={control}
                    name="originalBalance"
                    rules={{ required: true, validate: (val) => val >= 0 }}
                    render={({ field, fieldState: { error } }) => (
                        <InputCurrency
                            {...field}
                            label={`${classification === 'liability' ? 'Start' : 'Purchase'} value`}
                            placeholder="0"
                            error={error && 'Positive value is required'}
                        />
                    )}
                />

                {currentBalanceEditable && (
                    <Controller
                        control={control}
                        name="currentBalance"
                        rules={{
                            required: currentBalanceEditable,
                            min: 0,
                        }}
                        shouldUnregister
                        render={({ field, fieldState }) => (
                            <InputCurrency
                                {...field}
                                label="Current value"
                                placeholder="0"
                                error={fieldState.error && 'Positive value is required'}
                            />
                        )}
                    />
                )}
            </div>
        </>
    )
}
