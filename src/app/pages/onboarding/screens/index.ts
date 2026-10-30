import type { ComponentType } from "react";
import type { OnboardingStep } from "../steps";
import { BirthdayScreen } from "./BirthdayScreen";
import { CodeScreen } from "./CodeScreen";
import { FreeScreen } from "./FreeScreen";
import { NameStep } from "./NameStep";
import { PicksScreen } from "./PicksScreen";
import { SignUpScreen } from "./SignUpScreen";
import { WelcomeScreen } from "./WelcomeScreen";
import { WhereScreen } from "./WhereScreen";
import { YoursScreen } from "./YoursScreen";

/** The built screens. A step with no entry still shows the placeholder (the first-win PR). */
const SCREENS: Partial<Record<OnboardingStep, ComponentType>> = {
  welcome: WelcomeScreen,
  signup: SignUpScreen,
  code: CodeScreen,
  name: NameStep,
  birthday: BirthdayScreen,
  where: WhereScreen,
  picks: PicksScreen,
  free: FreeScreen,
  yours: YoursScreen,
};

export const screenFor = (step: OnboardingStep): ComponentType | undefined => SCREENS[step];
