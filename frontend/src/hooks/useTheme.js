import {
    useCallback,
    useState,
} from "react";


export default function useTheme() {
    const [theme, setTheme] =
        useState(
            () =>
                document.documentElement
                    .dataset.theme ??
                "dark",
        );


    const toggleTheme =
        useCallback(() => {
            setTheme(
                (current) => {
                    const next =
                        current === "dark"
                            ? "light"
                            : "dark";

                    document.documentElement
                        .dataset.theme = next;

                    localStorage.setItem(
                        "taskflow-theme",
                        next,
                    );

                    return next;
                },
            );
        }, []);


    return {
        theme,
        toggleTheme,
    };
}