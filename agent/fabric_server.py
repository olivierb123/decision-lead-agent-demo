from __future__ import annotations

from agent_framework_foundry_hosting import ResponsesHostServer
from dotenv import load_dotenv

from fabric_agent import build_fabric_agent

load_dotenv()


def main() -> None:
    agent = build_fabric_agent()
    server = ResponsesHostServer(agent)
    server.run()


if __name__ == "__main__":
    main()
