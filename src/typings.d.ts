declare module "selfsigned" {
    const selfsigned: {
        generate: () => {
            public: string,
            private: string,
            cert: string
        }
    };
    export default selfsigned;
}