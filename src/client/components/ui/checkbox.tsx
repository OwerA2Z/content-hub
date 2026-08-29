import { Checkbox as AntCheckbox } from "antd";
import * as React from "react";

export const Checkbox = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof AntCheckbox>>((props, _ref) => <AntCheckbox {...props} />);
Checkbox.displayName = "Checkbox";
