from __future__ import annotations

from agent_framework_foundry_hosting import ResponsesHostServer
from dotenv import load_dotenv

from agent import build_agent

load_dotenv()


def main() -> None:
    agent = build_agent()
    server = ResponsesHostServer(agent)
    server.run()


if __name__ == "__main__":
    main()
