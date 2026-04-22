import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { reactive } from 'vue';
import DatePicker from './DatePicker.vue';

describe('DatePicker.vue', () => {
    let wrapper;

    beforeEach(() => {
        wrapper = mount(DatePicker, {
            global: {
                plugins: [PrimeVue],
                stubs: {
                    teleport: true
                }
            },
            props: {
                modelValue: ''
            }
        });
    });

    it('should exist', async () => {
        expect(wrapper.find('.p-datepicker.p-component').exists()).toBe(true);
        expect(wrapper.find('.p-datepicker-input').exists()).toBe(true);

        let input = wrapper.find('.p-datepicker-input');

        await input.trigger('focus');

        expect(wrapper.find('.p-datepicker.p-component').exists()).toBe(true);
        expect(wrapper.find('.p-datepicker-today').exists()).toBe(true);
        expect(wrapper.find('.p-datepicker-prev-button').exists()).toBe(true);
        expect(wrapper.find('.p-datepicker-prev-next').exists()).toBe(false);
        expect(wrapper.find('.p-datepicker-today').text()).toEqual(new Date().getDate().toString());
    });

    it('should select a date', async () => {
        await wrapper.setProps({ inline: true });

        const event = { day: 8, month: 2, year: 2022, today: false, selectable: true };

        const onDateSelect = vi.spyOn(wrapper.vm, 'onDateSelect');

        await wrapper.vm.onDateSelect({ currentTarget: { focus: () => {} } }, event);
        expect(onDateSelect).toHaveBeenCalled();
    });

    it('should calculate the correct view date when in range mode', async () => {
        const dateOne = new Date();
        const dateTwo = new Date();

        dateTwo.setFullYear(dateOne.getFullYear(), dateOne.getMonth() + 2, dateOne.getDate());
        await wrapper.setProps({ selectionMode: 'range', showTime: true, modelValue: [dateOne, dateTwo] });

        const expectedViewDate = new Date(dateTwo.getFullYear(), dateTwo.getMonth(), 1);

        expect(wrapper.vm.viewDate.getFullYear()).toEqual(expectedViewDate.getFullYear());
        expect(wrapper.vm.viewDate.getMonth()).toEqual(expectedViewDate.getMonth());
    });

    it('should open a year view when there is selected date (fix: #6203)', async () => {
        const dateOne = new Date();

        dateOne.setFullYear(1988, 9, 10);

        await wrapper.setProps({ modelValue: dateOne });

        const input = wrapper.find('.p-datepicker-input');

        await input.trigger('focus');

        const yearSelectButton = wrapper.find('.p-datepicker .p-datepicker-select-year');

        expect(yearSelectButton.exists()).toBe(true);
        expect(yearSelectButton.text()).toBe('1988');

        await yearSelectButton.trigger('click');

        expect(wrapper.find('.p-datepicker-decade').exists()).toBe(true);
        expect(wrapper.find('.p-datepicker-decade').text()).toBe('1980 - 1989');
    });

    it('should not show other months when showOtherMonths is false', async () => {
        const dateOne = new Date();

        dateOne.setFullYear(1988, 5, 15);

        await wrapper.setProps({ modelValue: dateOne, showOtherMonths: false });

        const input = wrapper.find('.p-datepicker-input');

        await input.trigger('focus');

        expect(wrapper.find('.p-datepicker-other-month span').exists()).toBe(false);

        await input.trigger('blur');

        await wrapper.setProps({ showOtherMonths: true });

        await input.trigger('focus');

        expect(wrapper.find('.p-datepicker-other-month span').exists()).toBe(true);
    });

    it('should correctly set the year when view="year" and value is set via the input', async () => {
        const dateOne = new Date();
        const dateTwo = new Date();

        dateTwo.setFullYear(1988, 5, 15);

        await wrapper.setProps({ view: 'year', dateFormat: 'yy', modelValue: dateOne });

        const input = wrapper.find('.p-datepicker-input');

        await input.trigger('focus');

        expect(wrapper.find('.p-datepicker-decade').exists()).toBe(true);
        expect(wrapper.find('.p-datepicker-decade').text()).toBe('2020 - 2029');

        await wrapper.setProps({ modelValue: dateTwo });

        expect(wrapper.find('.p-datepicker-decade').text()).toBe('1980 - 1989');
    });

    // Regression test for PrimeVue issue #7569:
    // When a DatePicker is used inside a form context (with a "name" prop), selecting the same
    // date twice in a row causes the input to display the raw Date.toString() format instead of
    // the configured dateFormat string. The root cause is that the "name" prop is propagated to
    // the inner InputText component, which also registers with the form via $pcForm. When a date
    // is selected, the form's onChange callback stores the raw Date object in the field state.
    // InputText's $formValue watcher then sets d_value to this Date object, and Vue's template
    // binding (:value="d_value") re-renders the input with Date.toString() — overwriting the
    // correctly formatted string that DatePicker set directly on the DOM element.
    //
    // This test is expected to fail while the bug exists in PrimeVue. Once PrimeVue fixes
    // the issue, this test will pass and the it.fails() wrapper should be removed.
    it.fails('should keep formatted input value when the same date is selected twice inside a form context (fix: PrimeVue #7569)', async () => {
        // Create a reactive form state mock that simulates PrimeVue's Form / useForm context.
        const fieldStates = reactive({});

        const $pcFormMock = {
            register(name) {
                if (!fieldStates[name]) {
                    fieldStates[name] = { value: null };
                }

                return {
                    onChange(event) {
                        // Mirrors the onChange logic from PrimeVue's useForm/index.js so that
                        // date-value events (with an explicit .value) and native input events
                        // (with event.target.value) are both handled correctly.
                        if (event && Object.hasOwn(event, 'value')) {
                            fieldStates[name].value = event.value;
                        } else {
                            fieldStates[name].value = event.target.type === 'checkbox' || event.target.type === 'radio' ? event.target.checked : event.target.value;
                        }
                    },
                    onBlur() {}
                };
            },
            getFieldState(name) {
                return fieldStates[name] ?? null;
            }
        };

        const formWrapper = mount(DatePicker, {
            global: {
                plugins: [PrimeVue],
                stubs: { teleport: true },
                provide: { $pcForm: $pcFormMock }
            },
            props: {
                name: 'birthdate',
                modelValue: null,
                dateFormat: 'mm/dd/yy'
            }
        });

        // Select April 15, 2024 for the first time.
        const dateMeta = { day: 15, month: 3, year: 2024, today: false, selectable: true };
        const fakeEvent = { currentTarget: { focus: () => {} } };

        await formWrapper.vm.onDateSelect(fakeEvent, dateMeta);
        await formWrapper.vm.$nextTick();

        // Select the exact same date again.
        await formWrapper.vm.onDateSelect(fakeEvent, dateMeta);
        await formWrapper.vm.$nextTick();

        // The input should still display the formatted date, not a raw Date.toString() value.
        const expectedFormatted = '04/15/24';

        expect(formWrapper.vm.input.value).toBe(expectedFormatted);
    });
});
