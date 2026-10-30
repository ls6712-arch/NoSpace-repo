import type { ComponentType } from "react";
import type { OnboardingStep } from "../steps";
import { BirthdayScreen } from "./BirthdayScreen";
import { CodeScreen } from "./CodeScreen";
import { NameStep } from "./NameStep";
import { SignUpScreen } from "./SignUpScreen";
import { WelcomeScreen } from "./WelcomeScreen";
import { WhereScreen } from "./WhereScreen";

/** The built screens. A step with no entry still shows the placeholder (the taste and first-win PRs). */
const SCREENS: Partial<Record<OnboardingStep, ComponentType>> = {
  welcome: WelcomeScreen,
  signup: SignUpScreen,
  code: CodeScreen,
  name: NameStep,
  birthday: BirthdayScreen,
  where: WhereScreen,
};

export const screenFor = (step: OnboardingStep): ComponentType | undefined => SCREENS[step];
